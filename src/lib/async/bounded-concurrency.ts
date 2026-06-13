export type BoundedTaskResult<T> =
  | {
      index: number;
      ok: true;
      value: T;
    }
  | {
      error: unknown;
      index: number;
      ok: false;
    };

export async function runBoundedTasks<T>(
  tasks: Array<() => Promise<T>>,
  concurrency: number
): Promise<Array<BoundedTaskResult<T>>> {
  const results = new Array<BoundedTaskResult<T>>(tasks.length);
  const workerCount = Math.min(Math.max(Math.floor(concurrency), 1), tasks.length);
  let nextIndex = 0;

  async function runWorker() {
    while (nextIndex < tasks.length) {
      const index = nextIndex;
      nextIndex += 1;

      try {
        results[index] = {
          index,
          ok: true,
          value: await tasks[index](),
        };
      } catch (error) {
        results[index] = {
          error,
          index,
          ok: false,
        };
      }
    }
  }

  await Promise.all(Array.from({ length: workerCount }, runWorker));
  return results;
}
