export type DependencyName = "postgres" | "redis";
export type DependencyState = "up" | "down";

export type DependencyPingers = Record<DependencyName, () => Promise<boolean>>;

export type DependencyHealth = {
  status: "ok" | "degraded";
  dependencies: Record<DependencyName, DependencyState>;
};

export async function checkDependencies(
  pingers: DependencyPingers
): Promise<DependencyHealth> {
  const entries = await Promise.all(
    Object.entries(pingers).map(async ([name, ping]) => {
      try {
        const isUp = await ping();
        return [name, isUp ? "up" : "down"] as const;
      } catch {
        return [name, "down"] as const;
      }
    })
  );

  const dependencies = Object.fromEntries(entries) as Record<
    DependencyName,
    DependencyState
  >;
  const status = Object.values(dependencies).every((state) => state === "up")
    ? "ok"
    : "degraded";

  return {
    status,
    dependencies
  };
}
