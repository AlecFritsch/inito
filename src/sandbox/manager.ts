import Docker from 'dockerode';
import { mkdirSync, existsSync, rmSync } from 'fs';
import { join } from 'path';
import { env } from '../config.js';

const docker = new Docker();

/**
 * Sandbox container configuration
 */
export interface SandboxConfig {
  runId: string;
  workspaceDir: string;
  timeout?: number;
}

/**
 * Sandbox instance
 */
export interface Sandbox {
  containerId: string;
  workspaceDir: string;
  exec: (command: string[]) => Promise<ExecResult>;
  cleanup: () => Promise<void>;
}

/**
 * Command execution result
 */
export interface ExecResult {
  exitCode: number;
  stdout: string;
  stderr: string;
}

/**
 * Create a sandbox container for a run
 */
export async function createSandbox(config: SandboxConfig): Promise<Sandbox> {
  const { runId, workspaceDir, timeout = env.sandboxTimeout } = config;

  // Ensure workspace directory exists
  if (!existsSync(workspaceDir)) {
    mkdirSync(workspaceDir, { recursive: true });
  }

  console.log(`[Sandbox] Creating container for run ${runId}`);

  // Create container
  const container = await docker.createContainer({
    Image: env.sandboxImage,
    name: `havoc-sandbox-${runId}`,
    Cmd: ['sleep', 'infinity'],
    WorkingDir: '/workspace',
    HostConfig: {
      Binds: [`${workspaceDir}:/workspace:rw`],
      Memory: 2 * 1024 * 1024 * 1024, // 2GB
      MemorySwap: 2 * 1024 * 1024 * 1024,
      CpuPeriod: 100000,
      CpuQuota: 100000, // 1 CPU
      NetworkMode: 'bridge',
      SecurityOpt: ['no-new-privileges'],
      ReadonlyRootfs: false,
      AutoRemove: false
    },
    User: 'havoc',
    Env: [
      'HOME=/home/havoc',
      'NPM_CONFIG_PREFIX=/home/havoc/.npm-global',
      `PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin:/home/havoc/.npm-global/bin`
    ]
  });

  // Start container
  await container.start();

  const containerId = container.id;
  console.log(`[Sandbox] Container ${containerId.slice(0, 12)} started`);

  // Create exec function
  const exec = async (command: string[]): Promise<ExecResult> => {
    return execInContainer(containerId, command, timeout);
  };

  // Create cleanup function
  const cleanup = async (): Promise<void> => {
    await cleanupSandbox(containerId, workspaceDir);
  };

  return {
    containerId,
    workspaceDir,
    exec,
    cleanup
  };
}

/**
 * Execute a command in a container
 */
async function execInContainer(
  containerId: string,
  command: string[],
  timeout: number
): Promise<ExecResult> {
  const container = docker.getContainer(containerId);

  console.log(`[Sandbox] Executing: ${command.join(' ')}`);

  const exec = await container.exec({
    Cmd: command,
    AttachStdout: true,
    AttachStderr: true,
    WorkingDir: '/workspace'
  });

  return new Promise((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      reject(new Error(`Command timed out after ${timeout}ms`));
    }, timeout);

    exec.start({ hijack: true, stdin: false }, (err: Error | null, stream: any) => {
      if (err) {
        clearTimeout(timeoutId);
        return reject(err);
      }

      let stdout = '';
      let stderr = '';

      // Demux the stream
      stream.on('data', (chunk: Buffer) => {
        // Docker multiplexes stdout and stderr in the stream
        // First 8 bytes are header: [stream_type, 0, 0, 0, size_bytes...]
        // stream_type: 1 = stdout, 2 = stderr
        let offset = 0;
        while (offset < chunk.length) {
          if (offset + 8 > chunk.length) break;
          
          const streamType = chunk[offset];
          const size = chunk.readUInt32BE(offset + 4);
          offset += 8;
          
          if (offset + size > chunk.length) break;
          
          const data = chunk.slice(offset, offset + size).toString('utf-8');
          if (streamType === 1) {
            stdout += data;
          } else if (streamType === 2) {
            stderr += data;
          }
          offset += size;
        }
      });

      stream.on('end', async () => {
        clearTimeout(timeoutId);
        
        try {
          const inspectResult = await exec.inspect();
          resolve({
            exitCode: inspectResult.ExitCode || 0,
            stdout: stdout.trim(),
            stderr: stderr.trim()
          });
        } catch (inspectError) {
          resolve({
            exitCode: -1,
            stdout: stdout.trim(),
            stderr: stderr.trim()
          });
        }
      });

      stream.on('error', (streamErr: Error) => {
        clearTimeout(timeoutId);
        reject(streamErr);
      });
    });
  });
}

/**
 * Cleanup a sandbox container and workspace
 */
export async function cleanupSandbox(
  containerId: string,
  workspaceDir?: string
): Promise<void> {
  console.log(`[Sandbox] Cleaning up container ${containerId.slice(0, 12)}`);

  try {
    const container = docker.getContainer(containerId);
    
    // Stop container
    try {
      await container.stop({ t: 5 });
    } catch (e) {
      // Container might already be stopped
    }

    // Remove container
    await container.remove({ force: true });
    console.log(`[Sandbox] Container removed`);
  } catch (error) {
    console.error(`[Sandbox] Error cleaning up container:`, error);
  }

  // Remove workspace directory
  if (workspaceDir && existsSync(workspaceDir)) {
    try {
      rmSync(workspaceDir, { recursive: true, force: true });
      console.log(`[Sandbox] Workspace removed: ${workspaceDir}`);
    } catch (error) {
      console.error(`[Sandbox] Error removing workspace:`, error);
    }
  }
}

/**
 * List all havoc sandbox containers
 */
export async function listSandboxes(): Promise<Docker.ContainerInfo[]> {
  const containers = await docker.listContainers({
    all: true,
    filters: {
      name: ['havoc-sandbox-']
    }
  });
  return containers;
}

/**
 * Cleanup all sandbox containers (for maintenance)
 */
export async function cleanupAllSandboxes(): Promise<number> {
  const containers = await listSandboxes();
  let cleaned = 0;

  for (const containerInfo of containers) {
    try {
      await cleanupSandbox(containerInfo.Id);
      cleaned++;
    } catch (error) {
      console.error(`Error cleaning up container ${containerInfo.Id}:`, error);
    }
  }

  return cleaned;
}

/**
 * Check if Docker is available
 */
export async function checkDocker(): Promise<boolean> {
  try {
    await docker.ping();
    return true;
  } catch {
    return false;
  }
}

/**
 * Check if sandbox image exists
 */
export async function checkSandboxImage(): Promise<boolean> {
  try {
    await docker.getImage(env.sandboxImage).inspect();
    return true;
  } catch {
    return false;
  }
}
