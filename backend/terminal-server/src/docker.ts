/**
 * Terminal Server - Docker Container Manager
 *
 * Manages Docker container lifecycle for terminal sessions
 */

import { spawn, ChildProcess } from 'child_process';

export interface ContainerConfig {
  userId: string;
  image: string;
  cpus: string;
  memory: string;
  pidsLimit: number;
  networkMode: string;
  timeout: number; // in milliseconds
}

export interface ContainerInfo {
  name: string;
  process: ChildProcess | null;
  createdAt: number;
  userId: string;
}

const DEFAULT_CONFIG: Omit<ContainerConfig, 'userId'> = {
  image: 'blog-terminal-sandbox',
  cpus: '0.5',
  memory: '128m',
  pidsLimit: 50,
  networkMode: 'none',
  timeout: 10 * 60 * 1000, // 10 minutes
};

// Track active containers
const activeContainers = new Map<string, ContainerInfo>();

/**
 * Generate unique container name
 */
export function generateContainerName(userId: string): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8);
  return `terminal-${userId}-${timestamp}-${random}`;
}

/**
 * Build Docker run arguments
 */
export function buildDockerArgs(
  containerName: string,
  config: ContainerConfig
): string[] {
  return [
    'run',
    '-i', // Interactive (stdin)
    '--rm', // Remove container when it exits
    '--name',
    containerName,
    '--network',
    config.networkMode,
    '--cpus',
    config.cpus,
    '--memory',
    config.memory,
    '--pids-limit',
    String(config.pidsLimit),
    // Security options
    '--security-opt',
    'no-new-privileges:true',
    '--cap-drop',
    'ALL',
    // Read-only root filesystem with writable /tmp
    '--read-only',
    '--tmpfs',
    '/tmp:rw,noexec,nosuid,size=64m',
    // Environment
    '--env',
    'TERM=xterm-256color',
    '--env',
    `USER_ID=${config.userId}`,
    // Image and command
    config.image,
    '/bin/sh',
  ];
}

/**
 * Start a new Docker container
 */
export function startContainer(
  userId: string,
  customConfig?: Partial<ContainerConfig>
): { containerName: string; args: string[] } {
  const config: ContainerConfig = {
    ...DEFAULT_CONFIG,
    ...customConfig,
    userId,
  };

  const containerName = generateContainerName(userId);
  const args = buildDockerArgs(containerName, config);

  // Track container
  activeContainers.set(containerName, {
    name: containerName,
    process: null,
    createdAt: Date.now(),
    userId,
  });

  return { containerName, args };
}

/**
 * Stop and remove a container
 */
export async function stopContainer(containerName: string): Promise<void> {
  return new Promise((resolve) => {
    const proc = spawn('docker', ['rm', '-f', containerName], {
      stdio: 'ignore',
    });

    proc.on('close', () => {
      activeContainers.delete(containerName);
      resolve();
    });

    proc.on('error', () => {
      activeContainers.delete(containerName);
      resolve();
    });
  });
}

/**
 * Get container info
 */
export function getContainerInfo(
  containerName: string
): ContainerInfo | undefined {
  return activeContainers.get(containerName);
}

/**
 * List all active containers for a user
 */
export function getUserContainers(userId: string): ContainerInfo[] {
  return Array.from(activeContainers.values()).filter(
    (c) => c.userId === userId
  );
}

/**
 * Clean up stale containers (older than timeout)
 */
export async function cleanupStaleContainers(
  timeout: number = DEFAULT_CONFIG.timeout
): Promise<number> {
  const now = Date.now();
  let cleaned = 0;

  for (const [name, info] of activeContainers) {
    if (now - info.createdAt > timeout) {
      await stopContainer(name);
      cleaned++;
    }
  }

  return cleaned;
}

/**
 * Get container stats
 */
export function getContainerStats(): {
  active: number;
  byUser: Record<string, number>;
} {
  const byUser: Record<string, number> = {};

  for (const info of activeContainers.values()) {
    byUser[info.userId] = (byUser[info.userId] || 0) + 1;
  }

  return {
    active: activeContainers.size,
    byUser,
  };
}
