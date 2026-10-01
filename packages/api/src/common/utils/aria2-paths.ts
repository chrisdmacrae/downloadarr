/**
 * aria2 may see the download folder at another path than this server does. In
 * Docker Compose aria2 is a container of its own, with the folder mounted at
 * /downloads, while this server has it at DOWNLOAD_PATH (/app/downloads).
 * ARIA2_DOWNLOAD_PATH says where aria2 has it, for a setup where it isn't
 * /downloads.
 */
type Env = Record<string, string | undefined>;

const trimmed = (path: string) => (path.length > 1 ? path.replace(/\/+$/, '') : path);

function roots(env: Env) {
  return {
    server: trimmed(env.DOWNLOAD_PATH || '/app/downloads'),
    aria2: trimmed(env.ARIA2_DOWNLOAD_PATH || '/downloads'),
  };
}

const within = (path: string, root: string) => path === root || path.startsWith(`${root}/`);

/** Where aria2 should put a download, given a path as this server sees it. */
export function toAria2Path(serverPath: string | undefined, env: Env = process.env): string {
  const { server, aria2 } = roots(env);
  if (!serverPath) return aria2;
  if (within(serverPath, server)) return aria2 + serverPath.slice(server.length);
  if (within(serverPath, aria2)) return serverPath;
  // Anything else is a folder inside the download folder.
  return `${aria2}/${serverPath.replace(/^\/+/, '')}`;
}

/** Where this server finds a file aria2 reports. */
export function fromAria2Path(aria2Path: string, env: Env = process.env): string {
  const { server, aria2 } = roots(env);
  if (within(aria2Path, aria2)) return server + aria2Path.slice(aria2.length);
  if (within(aria2Path, server)) return aria2Path;
  return `${server}/${aria2Path.replace(/^\/+/, '')}`;
}
