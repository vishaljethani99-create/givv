// Collects sign labels, and after a pause sends ONLY text to the backend to get one polite sentence.
export function createSession({ scenario = "general", lang = "en", pauseMs = 1500, endpoint = "/api/compose", onSigns, onSentence }) {
  let signs = [], history = [], timer;
  const compose = async () => {
    const batch = signs; signs = [];
    if (!batch.length) return;
    let sentence = batch.join(" ").toLowerCase(); // fallback if the backend is unreachable
    try {
      const r = await fetch(endpoint, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ signs: batch, scenario, lang, history }),
      });
      if (r.ok) sentence = (await r.json()).sentence || sentence;
    } catch { /* offline: keep fallback */ }
    history = [...history, { signs: batch, sentence }].slice(-5);
    onSentence?.(sentence);
  };
  return {
    push(s) { signs.push(s.label); onSigns?.([...signs]); clearTimeout(timer); timer = setTimeout(compose, pauseMs); },
    reset() { clearTimeout(timer); signs = []; },
  };
}
