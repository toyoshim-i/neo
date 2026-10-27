import { WebWorkerMLCEngineHandler } from '@mlc-ai/web-llm';

const handler = new WebWorkerMLCEngineHandler();

interface TvmInstanceLike {
  beginScope: () => void;
  endScope: () => void;
  getGlobalFunc: (name: string) => () => void;
}

interface PipelineLike {
  tvm?: TvmInstanceLike;
  resetChat?: (keepStats?: boolean) => void;
}

/**
 * Releases unused temporary prefill/decode workspace GPUBuffers cached inside TVM's PooledAllocator
 * (`vm.builtin.memory_manager.clear`) and resets single-turn KV cache state after each request.
 * Without this, different prompt token lengths accumulate separate pooled GPUBuffer buckets in VRAM.
 */
function flushWorkerPipelineMemoryPools(): void {
  try {
    const engineAny = handler.engine as unknown as {
      loadedModelIdToPipeline?: Map<string, PipelineLike>;
    };
    const pipelines = engineAny?.loadedModelIdToPipeline;
    if (!pipelines) return;
    for (const pipeline of pipelines.values()) {
      try {
        pipeline.resetChat?.(true);
      } catch {
        // Ignore resetChat error
      }
      if (pipeline?.tvm) {
        pipeline.tvm.beginScope();
        try {
          const clearPool = pipeline.tvm.getGlobalFunc(
            'vm.builtin.memory_manager.clear'
          );
          clearPool();
        } catch {
          // Ignore if clear func unavailable
        } finally {
          pipeline.tvm.endScope();
        }
      }
    }
  } catch {
    // Ignore cleanup errors
  }
}

self.onmessage = (msg: MessageEvent) => {
  const kind = msg?.data?.kind;
  handler.onmessage(msg, () => {
    if (
      kind === 'chatCompletionNonStreaming' ||
      kind === 'completionNonStreaming' ||
      kind === 'resetChat'
    ) {
      flushWorkerPipelineMemoryPools();
    }
  });
};
