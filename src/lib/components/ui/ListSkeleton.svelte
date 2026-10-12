<div class="divide-y divide-border" aria-hidden="true">
  {#each [0, 1, 2, 3, 4] as i (i)}
    <div class="flex items-start gap-2 py-3 pl-1.5 pr-4">
      <span class="h-8 w-2.5 shrink-0"></span>
      <div class="mr-1 h-8 w-8 shrink-0 animate-pulse rounded-full bg-muted"></div>
      <div class="flex min-w-0 flex-1 flex-col gap-2">
        <div class="h-3 w-1/3 animate-pulse rounded-full bg-muted"></div>
        <div class="h-3.5 w-3/4 animate-pulse rounded-full bg-muted"></div>
        <div class="h-5 w-24 animate-pulse rounded-md bg-muted"></div>
      </div>
    </div>
  {/each}
</div>
