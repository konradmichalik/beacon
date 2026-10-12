<script lang="ts">
  let {
    label,
    value = $bindable(''),
    type = 'text',
    placeholder,
    describedBy
  }: {
    label: string;
    value?: string;
    type?: 'text' | 'url' | 'password';
    placeholder?: string;
    describedBy?: string;
  } = $props();

  const id = $props.id();
</script>

<div class="flex flex-col gap-1">
  <label for={id} class="text-xs font-medium text-foreground">{label}</label>
  <input
    {id}
    {type}
    {value}
    {placeholder}
    aria-describedby={describedBy}
    oninput={(event) => (value = event.currentTarget.value)}
    class="h-[30px] rounded-[7px] border border-input bg-background px-2.5 text-[12.5px] text-foreground outline-none placeholder:text-subtlest focus:border-ring focus:ring-1 focus:ring-ring"
  />
</div>
