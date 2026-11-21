"use strict";

const TARIFA_POR_KWH = 1;
const DIAS_DO_MES = 30;
const MINUTOS_DO_DIA = 24 * 60;
const LINK_DA_AVALIACAO = ""; // Insira aqui o link de respostas do Google Forms.

const moeda = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const energia = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 3 });
const percentual = new Intl.NumberFormat("pt-BR", { style: "percent", maximumFractionDigits: 1 });

const aparelhos = new Map(
  Array.from(document.querySelectorAll("#aparelhos tr"), (linha) => [
    linha.dataset.id,
    {
      nome: linha.querySelector("th").textContent,
      watts: Number(linha.dataset.watts),
      minutos: Number(linha.dataset.minutes),
      variavel: linha.hasAttribute("data-variable")
    }
  ])
);

function campo(id) {
  return document.getElementById(id);
}

function calcularConsumo(aparelho, minutos, quantidade = 1) {
  // Guardamos watts × minutos para somar antes de converter e arredondar.
  return aparelho.watts * minutos * quantidade;
}

function mostrarEstimativa(modo, consumo) {
  for (const [periodo, dias] of [["day", 1], ["month", DIAS_DO_MES]]) {
    const kwh = consumo * dias / 60000;
    const custo = kwh * TARIFA_POR_KWH;

    campo(`${modo}-${periodo}-price`).textContent = custo > 0 && custo < 0.01
      ? "< R$ 0,01"
      : moeda.format(custo);
    campo(`${modo}-${periodo}-energy`).textContent = kwh > 0 && kwh < 0.001
      ? "< 0,001 kWh"
      : `${energia.format(kwh)} kWh`;
  }
}

function tempoEmTexto(minutos) {
  const horas = Math.floor(minutos / 60);
  const restante = minutos % 60;
  if (horas === 0) return `${restante} min`;
  if (restante === 0) return `${horas} h`;
  return `${horas} h ${restante} min`;
}

function preencherOpcoes(seletor) {
  for (const [id, aparelho] of aparelhos) {
    seletor.add(new Option(aparelho.nome, id));
  }
}

function mostrarPotencia(modo, aparelho) {
  const potencia = `${energia.format(aparelho.watts)} W`;
  campo(`${modo}-power`).textContent = aparelho.variavel
    ? `Potência média ilustrativa de ${potencia}. O consumo real varia.`
    : `Potência de referência de ${potencia}.`;
}

function iniciarMenu() {
  const botao = document.querySelector(".menu-toggle");
  const menu = campo("menu");
  botao.hidden = false;
  document.documentElement.classList.add("has-js");

  function fecharMenu() {
    botao.setAttribute("aria-expanded", "false");
  }

  botao.addEventListener("click", () => {
    const aberto = botao.getAttribute("aria-expanded") === "true";
    botao.setAttribute("aria-expanded", String(!aberto));
  });

  menu.addEventListener("click", (evento) => {
    const link = evento.target.closest("a");
    if (!link || botao.getAttribute("aria-expanded") !== "true") return;
    fecharMenu();
    const secao = document.querySelector(link.hash);
    secao.tabIndex = -1;
    secao.focus({ preventScroll: true });
  });

  document.addEventListener("keydown", (evento) => {
    if (evento.key === "Escape" && botao.getAttribute("aria-expanded") === "true") {
      fecharMenu();
      botao.focus();
    }
  });

  document.addEventListener("click", (evento) => {
    if (!menu.contains(evento.target) && !botao.contains(evento.target)) fecharMenu();
  });

  matchMedia("(max-width: 760px)").addEventListener("change", fecharMenu);
}

function iniciarAbas() {
  const abas = [...document.querySelectorAll(".tabs [role='tab']")];

  function abrirAba(ativa) {
    for (const aba of abas) {
      const selecionada = aba === ativa;
      aba.setAttribute("aria-selected", String(selecionada));
      aba.tabIndex = selecionada ? 0 : -1;
      campo(aba.getAttribute("aria-controls")).hidden = !selecionada;
    }
  }

  abas.forEach((aba, indice) => {
    aba.addEventListener("click", () => abrirAba(aba));
    aba.addEventListener("keydown", (evento) => {
      let destino;
      switch (evento.key) {
        case "ArrowRight":
          destino = (indice + 1) % abas.length;
          break;
        case "ArrowLeft":
          destino = (indice + abas.length - 1) % abas.length;
          break;
        case "Home":
          destino = 0;
          break;
        case "End":
          destino = abas.length - 1;
          break;
        default:
          return;
      }
      evento.preventDefault();
      abrirAba(abas[destino]);
      abas[destino].focus();
    });
  });
}

function iniciarSimulacaoIndividual() {
  const seletor = campo("single-device");
  const barra = campo("single-slider");
  const ajuste = campo("single-minutes");
  const tempo = campo("single-time");
  preencherOpcoes(seletor);

  function atualizar(minutos) {
    const aparelho = aparelhos.get(seletor.value);
    barra.value = minutos;
    ajuste.value = minutos;
    const duracao = tempoEmTexto(minutos);
    barra.setAttribute("aria-valuetext", duracao);
    tempo.textContent = duracao;
    mostrarEstimativa("single", calcularConsumo(aparelho, minutos));
  }

  function trocarAparelho() {
    const aparelho = aparelhos.get(seletor.value);
    mostrarPotencia("single", aparelho);
    atualizar(aparelho.minutos);
  }

  seletor.addEventListener("change", trocarAparelho);
  barra.addEventListener("input", () => atualizar(barra.valueAsNumber));
  ajuste.addEventListener("input", () => {
    if (ajuste.value && ajuste.validity.valid) atualizar(ajuste.valueAsNumber);
  });
  ajuste.addEventListener("change", () => {
    const minutos = ajuste.valueAsNumber;
    atualizar(Number.isFinite(minutos)
      ? Math.max(0, Math.min(MINUTOS_DO_DIA, Math.round(minutos)))
      : barra.valueAsNumber);
  });
  trocarAparelho();
}

function montarItem(item, indice) {
  const aparelho = aparelhos.get(item.id);
  const linha = document.createElement("li");
  const resumo = document.createElement("div");
  const titulo = document.createElement("strong");
  const uso = document.createElement("small");
  titulo.textContent = aparelho.nome;
  uso.textContent = `${item.quantidade}× · ${tempoEmTexto(item.minutos)} por unidade ao dia`;
  resumo.append(titulo, uso);

  const acoes = document.createElement("div");
  acoes.className = "row-actions";
  for (const acao of ["Editar", "Remover"]) {
    const botao = document.createElement("button");
    botao.type = "button";
    botao.dataset.acao = acao;
    botao.dataset.indice = indice;
    botao.textContent = acao;
    botao.setAttribute("aria-label", `${acao} ${aparelho.nome}, item ${indice + 1}`);
    acoes.append(botao);
  }
  linha.append(resumo, acoes);
  return linha;
}

function montarBarra(id, fracao) {
  const linha = document.createElement("li");
  const rotulo = document.createElement("div");
  const nome = document.createElement("span");
  const valor = document.createElement("strong");
  rotulo.className = "chart-label";
  nome.textContent = aparelhos.get(id).nome;
  if (fracao < 0.001) {
    valor.textContent = "< 0,1%";
  } else if (fracao >= 0.9995 && fracao < 1) {
    valor.textContent = "> 99,9%";
  } else {
    valor.textContent = percentual.format(fracao);
  }
  rotulo.append(nome, valor);

  const trilho = document.createElement("span");
  const barra = document.createElement("span");
  trilho.className = "chart-track";
  trilho.setAttribute("aria-hidden", "true");
  barra.className = "chart-bar";
  barra.style.width = `${fracao * 100}%`;
  trilho.append(barra);
  linha.append(rotulo, trilho);
  return linha;
}

function iniciarMinhaConta() {
  const itens = [];
  let editando = null;
  const formulario = campo("account-form");
  const seletor = campo("account-device");
  const quantidade = campo("account-quantity");
  const horas = campo("account-hours");
  const minutos = campo("account-minutes");
  const lista = campo("account-list");
  const grafico = campo("account-chart");
  const salvar = campo("save-device");
  const cancelar = campo("cancel-edit");
  const erro = campo("account-error");
  const status = campo("account-status");
  preencherOpcoes(seletor);

  function preencherTempo(total) {
    horas.value = Math.floor(total / 60);
    minutos.value = total % 60;
  }

  function limparErro() {
    erro.hidden = true;
    horas.removeAttribute("aria-invalid");
    minutos.removeAttribute("aria-invalid");
  }

  function trocarAparelho() {
    const aparelho = aparelhos.get(seletor.value);
    preencherTempo(aparelho.minutos);
    mostrarPotencia("account", aparelho);
    limparErro();
  }

  function concluirEdicao() {
    editando = null;
    quantidade.value = 1;
    cancelar.hidden = true;
    salvar.textContent = "Adicionar aparelho";
    trocarAparelho();
  }

  function renderizarConta() {
    const porAparelho = new Map();
    let total = 0;

    for (const item of itens) {
      const consumo = calcularConsumo(aparelhos.get(item.id), item.minutos, item.quantidade);
      total += consumo;
      porAparelho.set(item.id, (porAparelho.get(item.id) ?? 0) + consumo);
    }

    const ordenados = [...porAparelho].sort((a, b) => b[1] - a[1]);
    lista.replaceChildren(...itens.map(montarItem));
    grafico.replaceChildren(...ordenados.map(([id, consumo]) => montarBarra(id, consumo / total)));
    campo("account-empty").hidden = itens.length > 0;
    campo("chart-empty").hidden = itens.length > 0;
    mostrarEstimativa("account", total);
  }

  seletor.addEventListener("change", trocarAparelho);
  horas.addEventListener("input", limparErro);
  minutos.addEventListener("input", limparErro);

  formulario.addEventListener("submit", (evento) => {
    evento.preventDefault();
    const duracao = horas.valueAsNumber * 60 + minutos.valueAsNumber;
    if (duracao < 1 || duracao > MINUTOS_DO_DIA) {
      erro.hidden = false;
      erro.textContent = "Informe um uso diário de 1 minuto a 24 horas.";
      horas.setAttribute("aria-invalid", "true");
      minutos.setAttribute("aria-invalid", "true");
      horas.focus();
      return;
    }

    const item = { id: seletor.value, quantidade: quantidade.valueAsNumber, minutos: duracao };
    const nome = aparelhos.get(item.id).nome;
    if (editando === null) {
      itens.push(item);
      status.textContent = `${nome} foi adicionado à sua conta.`;
    } else {
      itens[editando] = item;
      status.textContent = `O item ${nome} foi atualizado.`;
    }
    concluirEdicao();
    renderizarConta();
  });

  cancelar.addEventListener("click", () => {
    concluirEdicao();
    seletor.focus();
  });

  lista.addEventListener("click", (evento) => {
    const botao = evento.target.closest("button[data-acao]");
    if (!botao) return;
    const indice = Number(botao.dataset.indice);
    const item = itens[indice];
    const aparelho = aparelhos.get(item.id);

    if (botao.dataset.acao === "Editar") {
      editando = indice;
      seletor.value = item.id;
      mostrarPotencia("account", aparelho);
      quantidade.value = item.quantidade;
      preencherTempo(item.minutos);
      limparErro();
      salvar.textContent = "Salvar alterações";
      cancelar.hidden = false;
      seletor.focus();
      return;
    }

    itens.splice(indice, 1);
    if (editando === indice) concluirEdicao();
    else if (editando !== null && editando > indice) editando -= 1;

    renderizarConta();
    status.textContent = `${aparelho.nome} foi removido da sua conta.`;
    const botoes = lista.querySelectorAll("[data-acao='Remover']");
    const proximo = botoes[Math.min(indice, botoes.length - 1)] ?? seletor;
    proximo.focus();
  });

  trocarAparelho();
  renderizarConta();
}

iniciarMenu();
iniciarAbas();
iniciarSimulacaoIndividual();
iniciarMinhaConta();
campo("simulator").hidden = false;

if (LINK_DA_AVALIACAO) {
  const link = campo("evaluation-link");
  link.href = LINK_DA_AVALIACAO;
  link.hidden = false;
  campo("form-status").hidden = true;
}
