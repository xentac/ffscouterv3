// Each feature gets its own folder
// Ideally CSS should be limited to positional shit (or just do inline)

export interface Feature {
  name: string;
  description: string;

  shouldRun: () => Promise<boolean>; // checks if feature is toggled + if should run on current page
  run: () => Promise<void>;
}
