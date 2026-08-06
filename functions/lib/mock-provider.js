export function createMockProvider(config) {
  let calls = 0;
  const behavior = config.mockBehavior || "success";

  return {
    config,
    callCount: () => calls,
    generateAnswer(params) {
      calls++;
      const signal = params.signal;
      return new Promise((resolve) => {
        if (behavior === "ignore_abort") {
          // Never resolves, ignores abort signal
          return;
        }
        if (behavior === "never_resolve") {
          if (signal) signal.addEventListener("abort", () => resolve({ text: "", usage: { input_tokens: 0, output_tokens: 0 }, model: config.model, aborted: true }), { once: true });
          return;
        }
        if (signal && signal.aborted) return resolve({ aborted: true, text: "", usage: { input_tokens: 0, output_tokens: 0 }, model: config.model });
        if (behavior === "429") return resolve({ status: 429, text: "", usage: { input_tokens: 0, output_tokens: 0 }, model: config.model });
        if (behavior === "500") return resolve({ status: 500, text: "", usage: { input_tokens: 0, output_tokens: 0 }, model: config.model });
        if (behavior === "empty") {
          const t = setTimeout(() => resolve({ text: "", usage: { input_tokens: 100, output_tokens: 0 }, model: config.model }), 100);
          if (signal) signal.addEventListener("abort", () => { clearTimeout(t); resolve({ aborted: true, text: "", usage: { input_tokens: 0, output_tokens: 0 }, model: config.model }); }, { once: true });
          return;
        }
        if (behavior === "invalid") {
          const t = setTimeout(() => resolve(null), 100);
          if (signal) signal.addEventListener("abort", () => { clearTimeout(t); resolve({ aborted: true, text: "", usage: { input_tokens: 0, output_tokens: 0 }, model: config.model }); }, { once: true });
          return;
        }
        // success
        const t = setTimeout(() => {
          const q = (params.userPrompt || "").toLowerCase();
          let a = "根据本站公开内容，我找到了相关信息。";
          if (q.includes("机器人") || q.includes("stewart")) a = "6-PUS Stewart并联机构文章介绍了运动学建模与工作空间分析的完整过程。";
          else if (q.includes("ros2") || q.includes("电缸")) a = "因时微型伺服电缸的ROS2控制文章介绍了从UART直连到Modbus总线的方案。";
          else if (q.includes("网站") || q.includes("文章")) a = "本站目前包含4篇已发布文章，涵盖教程、机器人和技术前沿。";
          resolve({ text: a, usage: { input_tokens: Math.ceil(a.length / 4), output_tokens: Math.ceil(a.length / 2) }, model: config.model });
        }, 200);
        if (signal) signal.addEventListener("abort", () => { clearTimeout(t); resolve({ aborted: true, text: "", usage: { input_tokens: 0, output_tokens: 0 }, model: config.model }); }, { once: true });
      });
    },
  };
}
