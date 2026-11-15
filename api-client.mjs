export function createApi(apiOrigin = "", storage, send = fetch) {
  const key = "moderaptor-session";
  let token;
  if (apiOrigin) {
    const url = new URL(apiOrigin);
    if (url.origin !== apiOrigin || url.protocol !== "https:")
      throw new Error("Endereço da API inválido.");
    try { token = storage?.getItem(key); } catch {}
  }
  return async function api(path, body) {
    const r = await send((apiOrigin || ".") + "/api/" + path, {
      credentials: apiOrigin ? "omit" : "same-origin",
      headers: {
        ...(body ? { "Content-Type": "application/json" } : {}),
        ...(apiOrigin && token ? { Authorization: "Bearer " + token } : {}),
      },
      ...(body ? { method: "POST", body: JSON.stringify(body) } : {}),
    });
    let data;
    try { data = await r.json(); } catch {
      throw new Error("O serviço está indisponível. Tenta novamente mais tarde.");
    }
    if (!r.ok)
      throw Object.assign(new Error(data.message || "Não foi possível concluir."), data);
    if (apiOrigin && /^[a-f0-9]{64}$/.test(data.sessionToken || "")) {
      token = data.sessionToken;
      try { storage?.setItem(key, token); } catch {}
    }
    return data;
  };
}
