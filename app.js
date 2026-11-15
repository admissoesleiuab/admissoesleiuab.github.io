import { createApi } from "./api-client.mjs";

const $ = (id) => document.getElementById(id);
let sessionStorageForApi;
try { sessionStorageForApi = window.sessionStorage; } catch {}
const requestApi = createApi(document.querySelector('meta[name="moderaptor-api"]')?.content || "", sessionStorageForApi);
const api = (path, body) => requestApi(path, body);
let config,
  resultStatus,
  verified = false,
  busy = false;
let codeDeadline = 0, codeInterval, resendDeadline = 0, resendInterval;
const errorIds = [
  "name",
  "studentNumber",
  "countryCode",
  "phone",
  "moodleId",
  "acceptRules",
  "courses",
];
function clearErrors() {
  for (const id of errorIds) {
    $(id + "-error").textContent = "";
    $(id)?.removeAttribute("aria-invalid");
  }
  $("form-error").hidden = true;
}
function showError(e) {
  $("form-error").textContent = e.message;
  $("form-error").hidden = false;
  for (const [key, value] of Object.entries(e.fields || {})) {
    if ($(key + "-error")) {
      $(key + "-error").textContent = value;
      $(key)?.setAttribute("aria-invalid", "true");
    }
  }
  $("form-error").focus();
}
function setVerified(value) {
  verified = value;
  $("email-state").textContent = value
    ? "Email confirmado"
    : "Confirma o teu email";
  $("send-code").textContent = value ? "Enviar novo código" : "Enviar código";
  $("code-validity").hidden = value || !Number.isFinite(config?.codeTtlSeconds);
  $("verify-message").classList.toggle("success", value);
  $("verify-message").textContent = value
    ? "Código válido. Email confirmado. Podes continuar a preencher o formulário."
    : "";
  if (value) {
    stopCountdown();
    $("code-area").hidden = true;
  }
  updateResend();
}
function updateResend() {
  if (!config?.codeResendSeconds) return;
  const seconds = Math.max(0, Math.ceil((resendDeadline - Date.now()) / 1000));
  $("send-code").disabled = busy || seconds > 0;
  $("send-code").textContent = verified ? "Enviar novo código" : seconds
    ? `Novo código em ${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`
    : "Enviar código";
  if (!seconds) clearInterval(resendInterval);
}
function setResend(r) {
  if (!config?.codeResendSeconds || !r.resendAt) return;
  const remaining = Date.parse(r.resendAt) - Date.parse(r.serverTime);
  if (!Number.isFinite(remaining)) return;
  resendDeadline = Date.now() + Math.max(0, remaining);
  clearInterval(resendInterval);
  if (remaining > 0) resendInterval = setInterval(updateResend, 1000);
  updateResend();
}
function stopCountdown() {
  clearInterval(codeInterval);
  codeDeadline = 0;
  $("code-countdown").hidden = true;
}
function updateCountdown() {
  if (!codeDeadline) return;
  const seconds = Math.max(0, Math.ceil((codeDeadline - Date.now()) / 1000));
  $("code-clock").textContent = `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
  $("verify-code").disabled = busy || seconds === 0;
  if (!seconds) {
    clearInterval(codeInterval);
    $("verify-message").textContent = config.singleCodeAttempt
      ? "O código expirou. Contacta o operador do ensaio; cada email tem uma única tentativa de envio."
      : "O código expirou. Pede um novo código para continuar.";
  }
}
function showCode(r) {
  setResend(r);
  if (r.studentNumber) $("studentNumber").value = r.studentNumber;
  stopCountdown();
  $("verify-message").textContent = "";
  $("code-area").hidden = false;
  $("code-message").textContent = r.demoCode
    ? `${r.message} Código: ${r.demoCode}`
    : r.message || "Introduz o código já pedido. O prazo mantém-se.";
  const remaining = Date.parse(r.expiresAt) - Date.parse(r.serverTime);
  if (Number.isFinite(remaining)) {
    // Use the server's remaining lifetime, including SMTP delay, despite client clock skew.
    codeDeadline = Date.now() + Math.max(0, remaining);
    $("code-countdown").hidden = false;
    codeInterval = setInterval(updateCountdown, 1000);
    updateCountdown();
  }
}
function resetEmail() {
  stopCountdown();
  setVerified(false);
  $("code-area").hidden = true;
  $("code").value = "";
  $("verify-message").textContent = "";
}
function counts() {
  for (let year = 1; year <= 3; year++) {
    const n = document.querySelectorAll(
      `[data-year="${year}"] input:checked`,
    ).length;
    $("count-" + year).textContent = n ? String(n) : "";
    $("count-" + year).hidden = !n;
  }
}
function formData() {
  return {
    name: $("name").value,
    studentNumber: $("studentNumber").value,
    countryCode: $("countryCode").value,
    phone: $("phone").value,
    moodleId: $("moodleId").value,
    acceptRules: $("acceptRules").checked,
    rulesVersion: config.rulesVersion,
    courses: [...document.querySelectorAll('[name="course"]:checked')].map(
      (x) => x.value,
    ),
    website: $("website").value,
  };
}
function required() {
  const fields = {};
  for (const id of [
    "name",
    "studentNumber",
    "countryCode",
    "phone",
    "moodleId",
    "acceptRules",
  ]) {
    if (!$(id).checkValidity())
      fields[id] =
        id === "acceptRules"
          ? "Lê e aceita as regras para continuar."
          : "Confirma este campo obrigatório.";
  }
  if (Object.keys(fields).length)
    throw Object.assign(new Error("Há dados a corrigir."), { fields });
  if (!verified)
    throw Object.assign(new Error("Confirma o teu email antes de submeter."), {
      fields: {
        studentNumber: "Pede o código e confirma o email institucional.",
      },
    });
}
function showResult(r) {
  resultStatus = r.status;
  $("status-message").textContent = "";
  $("application").hidden = true;
  $("result").hidden = false;
  $("result-title").textContent = r.title;
  $("result-message").textContent = r.message;
  $("result-reference").textContent = r.reference;
  $("result-eyebrow").textContent =
    config.mode === "demo" ? "RESULTADO SIMULADO" : "ADMISSÃO RECEBIDA";
  $("result-access").textContent = r.accessConfirmed
    ? "Acesso já confirmado."
    : r.status === "authorized"
      ? "A autorização está registada. A entrada no grupo ainda não está confirmada."
      : "Podes voltar a consultar o estado durante esta sessão.";
  $("result").classList.toggle(
    "review",
    ["needs_review", "pending_existing", "rejected"].includes(r.status),
  );
  $("result").querySelector(".result-symbol").textContent =
    r.status === "rejected" ? "×" : r.status === "needs_review" ? "…" : "✓";
  $("result").focus();
}
$("studentNumber").addEventListener("input", resetEmail);
$("send-code").addEventListener("click", async () => {
  if (busy || !config || $("send-code").disabled) return;
  if (!$("studentNumber").checkValidity()) {
    $("studentNumber").reportValidity();
    return;
  }
  busy = true;
  $("send-code").disabled = true;
  $("verify-message").textContent = "";
  try {
    const r = await api("challenge", {
      studentNumber: $("studentNumber").value,
    });
    setVerified(false);
    showCode(r);
    $("code").value = "";
    $("code").focus();
  } catch (e) {
    setResend(e);
    $("verify-message").textContent = e.message;
  } finally {
    busy = false;
    $("send-code").disabled = false;
    updateCountdown();
    updateResend();
  }
});
$("verify-code").addEventListener("click", async () => {
  if (busy || $("verify-code").disabled) return;
  if (codeDeadline && Date.now() >= codeDeadline) { updateCountdown(); return; }
  busy = true;
  $("verify-code").disabled = true;
  try {
    await api("verify", { code: $("code").value });
    setVerified(true);
    try {
      const status = await api("status");
      if (status.status !== "not_submitted") showResult(status);
      else $("moodleId").focus();
    } catch {
      $("verify-message").textContent += " Não foi possível consultar o estado da candidatura. Tenta atualizar a página.";
    }
  } catch (e) {
    $("verify-message").textContent = e.error === "invalid_code"
      ? "Código inválido. Confirma os seis algarismos recebidos por email e tenta novamente."
      : ["code_expired", "verification_required"].includes(e.error)
        ? "Este código já não é válido. Pede um novo código."
        : e.message;
  } finally {
    busy = false;
    $("verify-code").disabled = false;
    updateCountdown();
    updateResend();
  }
});
$("code").addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    e.preventDefault();
    $("verify-code").click();
  }
});
$("help-button").addEventListener("click", () => {
  const open = $("moodle-help").hidden;
  $("moodle-help").hidden = !open;
  $("help-button").setAttribute("aria-expanded", String(open));
});
$("application").addEventListener("submit", async (e) => {
  e.preventDefault();
  if (busy || !config) return;
  clearErrors();
  try {
    required();
  } catch (error) {
    showError(error);
    return;
  }
  busy = true;
  $("submit").disabled = true;
  $("submit").firstElementChild.textContent = "A validar pedido de admissão…";
  try {
    showResult(await api("submit", formData()));
  } catch (error) {
    if (error.error === "verification_required") resetEmail();
    showError(error);
  } finally {
    busy = false;
    $("submit").disabled = false;
    $("submit").firstElementChild.textContent =
      "Validar e submeter pedido de admissão";
  }
});
$("restart").addEventListener("click", () => {
  if (config.allowTestRegistrationDuplicates) resetEmail();
  $("result").hidden = true;
  $("application").hidden = false;
  $("application").scrollIntoView({ block: "start" });
});
$("refresh-status").addEventListener("click", async () => {
  $("refresh-status").disabled = true;
  $("status-message").textContent = "";
  try {
    const previousStatus = resultStatus;
    const r = await api("status");
    showResult(r);
    const context = r.accessConfirmed
      ? "Já estás dentro! Os teus colegas aguardam por ti no WhatsApp."
      : {
          needs_review: previousStatus === "needs_review"
            ? "Mantém-se em análise. Aguarda a resposta da equipa de moderação."
            : "O teu pedido está agora em análise pela equipa de moderação.",
          pending_existing: "O teu pedido continua em curso. Não precisas de o submeter novamente.",
          authorized: "O teu pedido foi aprovado. Aguarda a confirmação de entrada no grupo.",
          rejected: "O teu pedido não foi aprovado. Podes contactar a moderação para esclarecer a decisão.",
        }[r.status] || "Consulta os detalhes do teu pedido acima.";
    $("status-message").textContent = `Estado atualizado. ${context}`;
  } catch (error) {
    $("status-message").textContent = error.error === "verification_required"
      ? "A sessão terminou. Volta ao formulário e confirma novamente o teu email para consultar a admissão."
      : error.message;
  } finally { $("refresh-status").disabled = false; }
});
$("example").addEventListener("change", () => {
  const item = config.examples.find(
    (x) => x.studentNumber === $("example").value,
  );
  if (!item) return;
  $("name").value = item.name;
  $("studentNumber").value = item.studentNumber;
  $("moodleId").value = item.moodleId;
  $("countryCode").value = "+351";
  $("phone").value = "900000000";
  $("acceptRules").checked = false;
  resetEmail();
  clearErrors();
  $("result").hidden = true;
  $("application").hidden = false;
});
try {
  config = await api("config");
  if (Number.isFinite(config.codeTtlSeconds)) {
    if (config.allowTestRegistrationDuplicates) {
      $("restart").textContent = "Nova inscrição de teste";
    }
    $("code-validity").textContent = `Tens ${config.codeTtlSeconds / 60} minutos para confirmar o código recebido por email, a partir da confirmação do envio.`;
    if (config.codeResendSeconds) $("code-validity").textContent += " Podes pedir outro código ao fim de três minutos.";
    $("code-validity").hidden = false;
  }
  $("email-domain").textContent = "@" + config.emailDomain;
  const rulesList = document.createElement("ol");
  rulesList.className = "rules-list";
  for (const [index, value] of config.rules.entries()) {
    const item = document.createElement("li");
    if (config.ruleHeadings?.[index]) {
      const title = document.createElement("strong");
      title.textContent = config.ruleHeadings[index];
      item.append(title);
    }
    const p = document.createElement("p");
    p.textContent = value;
    item.append(p);
    rulesList.append(item);
  }
  $("rules-copy").append(rulesList);
  for (const [title, value] of [
    ["Ajuda", config.rulesHelp],
    ["Registo de atividade", config.activityNotice],
  ]) {
    if (!value) continue;
    const heading = document.createElement("h3"),
      p = document.createElement("p");
    heading.textContent = title;
    p.textContent = value;
    $("rules-copy").append(heading, p);
  }
  if (config.activityContact && config.contactEmail) {
    const p = document.createElement("p"),
      link = document.createElement("a");
    link.href = "mailto:" + config.contactEmail;
    link.textContent = config.contactEmail;
    p.append(
      document.createTextNode(config.activityContact + " "),
      link,
      document.createTextNode("."),
    );
    $("rules-copy").append(p);
  }
  if (config.rulesUrl) {
    $("rules-link").href = config.rulesUrl;
    $("rules-link").hidden = false;
  }
  if (config.privacyUrl) {
    const privacy = new URL(config.privacyUrl, location.href);
    if (privacy.username || privacy.password ||
        (privacy.protocol !== "https:" && !(config.mode === "demo" && privacy.origin === location.origin)))
      throw new Error("O aviso de privacidade não está disponível.");
    for (const id of ["privacy-link", "privacy-code-link"]) {
      if (!$(id)) continue;
      $(id).href = privacy.href;
      $(id).hidden = false;
    }
  } else if (config.mode !== "demo") {
    throw new Error("O aviso de privacidade não está disponível.");
  }
  if (config.contactEmail) {
    $("contact").href = "mailto:" + config.contactEmail;
    $("contact").hidden = false;
  }
  for (let year = 1; year <= 3; year++) {
    const d = document.createElement("details");
    d.dataset.year = String(year);
    const s = document.createElement("summary");
    const t = document.createElement("span");
    t.textContent = year + "º Ano";
    const count = document.createElement("span");
    count.id = "count-" + year;
    count.className = "count";
    count.hidden = true;
    const arrow = document.createElement("span");
    arrow.className = "chevron";
    arrow.setAttribute("aria-hidden", "true");
    s.append(t, count, arrow);
    d.append(s);
    const list = document.createElement("div");
    list.className = "course-list";
    const yearCourses = config.courses.filter((c) => c.year === year);
    const groups = [
      [
        "1.º semestre",
        yearCourses.filter((c) => c.semester === 1 && !c.extracurricular),
      ],
      [
        "2.º semestre",
        yearCourses.filter((c) => c.semester === 2 && !c.extracurricular),
      ],
      ["Extracurricular", yearCourses.filter((c) => c.extracurricular)],
      [
        "Outras UCs",
        yearCourses.filter((c) => !c.semester && !c.extracurricular),
      ],
    ];
    for (const [title, courses] of groups) {
      if (!courses.length) continue;
      const group = document.createElement("fieldset"),
        legend = document.createElement("legend");
      group.className = "course-semester";
      legend.textContent = title;
      group.append(legend);
      for (const course of courses) {
        const label = document.createElement("label"),
          input = document.createElement("input");
        input.type = "checkbox";
        input.name = "course";
        input.value = course.id;
        input.addEventListener("change", counts);
        label.append(input, document.createTextNode(course.label));
        group.append(label);
      }
      list.append(group);
    }
    d.append(list);
    $("years").append(d);
  }
  if (config.mode === "demo") {
    $("privacy-before-code").textContent = "Esta demonstração usa apenas dados fictícios. O código é apresentado no ecrã e nenhum email é enviado.";
    $("demo").hidden = false;
    for (const example of config.examples) {
      const option = document.createElement("option");
      option.value = example.studentNumber;
      option.textContent = example.label;
      $("example").append(option);
    }
  }
  $("submit").disabled = false;
  $("send-code").disabled = false;
  try {
    const r = await api("status");
    $("studentNumber").value = r.studentNumber;
    setResend(r);
    setVerified(true);
    if (r.status !== "not_submitted") showResult(r);
  } catch {
    if (config.codeTtlSeconds) try {
      const pending = await api("verification");
      if (pending.verified) {
        $("studentNumber").value = pending.studentNumber;
        setResend(pending);
        setVerified(true);
      } else showCode(pending);
    } catch {}
  }
} catch (e) {
  $("load-error").textContent =
    "O formulário não está disponível. " + e.message;
  $("load-error").hidden = false;
  $("submit").disabled = true;
  $("send-code").disabled = true;
}
