export function repoShortName(repository: string): string {
  return repository.split('/').slice(-2).join('/');
}
