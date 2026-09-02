/* ==========================================================================
   ui.js — pequenos auxiliares de interface (sem dependências externas)
   ========================================================================== */

/** Cria um elemento. `props.texto` escreve texto seguro; nunca usamos innerHTML com dados. */
export function el(etiqueta, props = {}, filhos = []) {
  const nodo = document.createElement(etiqueta);
  Object.entries(props).forEach(([chave, valor]) => {
    if (valor === null || valor === undefined || valor === false) return;
    if (chave === 'texto') nodo.textContent = valor;
    else if (chave === 'classe') nodo.className = valor;
    else if (chave === 'ao') Object.entries(valor).forEach(([ev, fn]) => nodo.addEventListener(ev, fn));
    else if (chave === 'dados') Object.entries(valor).forEach(([d, v]) => { nodo.dataset[d] = v; });
    else if (chave in nodo && chave !== 'list') nodo[chave] = valor;
    else nodo.setAttribute(chave, valor);
  });
  (Array.isArray(filhos) ? filhos : [filhos]).forEach((filho) => {
    if (filho === null || filho === undefined || filho === false) return;
    nodo.append(filho.nodeType ? filho : document.createTextNode(String(filho)));
  });
  return nodo;
}

export function limpar(nodo) { while (nodo.firstChild) nodo.firstChild.remove(); }

/* -------------------------------------------------------------------------
   Ícones (SVG traçado, herdam a cor do texto)
   ------------------------------------------------------------------------- */

/* Cada ícone é um traçado, ou uma lista deles quando precisa de mais que um. */
const CAMINHOS = {
  marca: ['M8 7h8a5 5 0 0 1 0 10H8A5 5 0 0 1 8 7z', 'M9.5 12.3l1.8 1.8 3.5-3.7'],
  hoje: 'M8 2v3M16 2v3M3.5 9h17M4 5.5h16a1 1 0 011 1V20a1 1 0 01-1 1H4a1 1 0 01-1-1V6.5a1 1 0 011-1z',
  comprimido: 'M10.5 3.5a5 5 0 017 7l-7 10a5 5 0 01-7-7z M7 7l7 7',
  caixa: 'M3 7h18v13a1 1 0 01-1 1H4a1 1 0 01-1-1zM3 7l2-4h14l2 4M9 12h6',
  historico: 'M12 8v5l3 2M3.5 12a8.5 8.5 0 108.5-8.5A8.4 8.4 0 006 6M3 3v4h4',
  ajustes: 'M12 15.5a3.5 3.5 0 100-7 3.5 3.5 0 000 7z M19.4 15a1.6 1.6 0 00.3 1.8l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.6 1.6 0 00-1.8-.3 1.6 1.6 0 00-1 1.5V21a2 2 0 11-4 0v-.1A1.6 1.6 0 008 19.4a1.6 1.6 0 00-1.8.3l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.6 1.6 0 00.3-1.8 1.6 1.6 0 00-1.5-1H2a2 2 0 110-4h.1A1.6 1.6 0 004.6 8a1.6 1.6 0 00-.3-1.8l-.1-.1a2 2 0 112.8-2.8l.1.1a1.6 1.6 0 001.8.3H9a1.6 1.6 0 001-1.5V2a2 2 0 114 0v.1a1.6 1.6 0 001 1.5 1.6 1.6 0 001.8-.3l.1-.1a2 2 0 112.8 2.8l-.1.1a1.6 1.6 0 00-.3 1.8V9a1.6 1.6 0 001.5 1H22a2 2 0 110 4h-.1a1.6 1.6 0 00-1.5 1z',
  visto: 'M4 12.5l5.5 5.5L20 6.5',
  cruz: 'M6 6l12 12M18 6L6 18',
  mais: 'M12 5v14M5 12h14',
  relogio: 'M12 7v5l3 2M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
  aviso: 'M12 9v5M12 17.5v.5M10.3 3.9L2.5 17.4A2 2 0 004.2 20.5h15.6a2 2 0 001.7-3.1L13.7 3.9a2 2 0 00-3.4 0z',
  imprimir: 'M6 9V3h12v6M6 18H4a1 1 0 01-1-1v-6a1 1 0 011-1h16a1 1 0 011 1v6a1 1 0 01-1 1h-2M6 14h12v7H6z',
  descarregar: 'M12 3v12M7 11l5 5 5-5M4 20h16',
  lapis: 'M4 20h4L19.5 8.5a2.1 2.1 0 00-3-3L5 17v3z',
  caixote: 'M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v6M14 11v6',
  frasco: 'M9 3h6v4l3.6 9.6A3 3 0 0115.8 21H8.2a3 3 0 01-2.8-4.4L9 7z M7 14h10',
};

export function icone(nome, tamanho) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '2.2');
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');
  svg.setAttribute('aria-hidden', 'true');
  if (tamanho) { svg.style.width = tamanho; svg.style.height = tamanho; }
  const tracos = CAMINHOS[nome] || CAMINHOS.comprimido;
  (Array.isArray(tracos) ? tracos : [tracos]).forEach((d) => {
    const caminho = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    caminho.setAttribute('d', d);
    svg.append(caminho);
  });
  return svg;
}

/**
 * Imprime apenas o conteúdo indicado, abrindo uma nova janela isolada.
 * É o método mais fiável: escapa a CSS da app, ao layout do modal, aos
 * containers com overflow — o browser recebe HTML limpo e imprime-o.
 * Faz clone do elemento e remove tudo com `.sem-impressao` (barras de botões).
 */
export function imprimirApenas(elemento) {
  if (!elemento) { window.print(); return; }
  const clone = elemento.cloneNode(true);
  clone.querySelectorAll('.sem-impressao').forEach((n) => n.remove());
  clone.style.display = 'block';
  clone.style.position = 'static';
  const estilos = `
    body { font-family: -apple-system, "Segoe UI", Roboto, sans-serif; color: #1a1a1a; padding: 20px; background: #fff; margin: 0; }
    h1, h2, h3 { margin: 0 0 8px; }
    p { margin: 4px 0 10px; color: #333; font-size: 13px; }
    table { width: 100%; border-collapse: collapse; font-size: 12px; margin-top: 8px; }
    th, td { padding: 6px 8px; border-bottom: 1px solid #ccc; text-align: left; vertical-align: top; }
    thead th { background: #f0f4f8; border-bottom: 2px solid #999; font-weight: 600; }
    tbody tr:nth-child(even) { background: #fafbfd; }
    img { max-width: 50px; max-height: 50px; object-fit: contain; }
    .campo__ajuda { color: #666; font-size: 11px; margin-top: 14px; }
    @page { margin: 12mm; }
  `;
  const html = `<!doctype html><html lang="pt"><head><meta charset="utf-8"><title>Dose Certa — Imprimir</title><style>${estilos}</style></head><body>${clone.outerHTML}</body></html>`;
  const janela = window.open('', '_blank');
  if (!janela) { window.print(); return; }
  janela.document.open();
  janela.document.write(html);
  janela.document.close();
  // Espera as imagens carregarem antes de imprimir para elas aparecerem no PDF.
  const disparar = () => setTimeout(() => { janela.focus(); janela.print(); }, 250);
  if (janela.document.readyState === 'complete') disparar();
  else janela.addEventListener('load', disparar);
}

/* -------------------------------------------------------------------------
   Avisos ligeiros
   ------------------------------------------------------------------------- */

let temporizadorAviso = null;

export function avisar(mensagem) {
  document.querySelector('.aviso-flutuante')?.remove();
  const nodo = el('div', { classe: 'aviso-flutuante', role: 'status', texto: mensagem });
  document.body.append(nodo);
  clearTimeout(temporizadorAviso);
  temporizadorAviso = setTimeout(() => nodo.remove(), 3600);
}

/* -------------------------------------------------------------------------
   Janela modal reutilizável
   ------------------------------------------------------------------------- */

export function abrirModal({ titulo, corpo, accoes = [], aoFechar }) {
  document.querySelector('dialog.modal')?.remove();

  const janela = el('dialog', { classe: 'modal', 'aria-label': titulo });
  const fechar = () => { janela.close(); };

  const cabeca = el('div', { classe: 'modal__cabeca' }, [
    el('h2', { texto: titulo }),
    el('button', { classe: 'modal__fechar', type: 'button', 'aria-label': 'Fechar',
                   ao: { click: fechar } }, [icone('cruz', '1.3rem')]),
  ]);

  const corpoNodo = el('div', { classe: 'modal__corpo' }, [corpo]);
  const rodape = accoes.length
    ? el('div', { classe: 'modal__rodape' }, accoes.map((accao) => el('button', {
        classe: `btn ${accao.classe || 'btn--neutro'}${accao.largo ? ' btn--largo' : ''}`,
        type: 'button',
        texto: accao.rotulo,
        ao: { click: () => accao.aoClicar?.(fechar) },
      })))
    : null;

  janela.append(cabeca, corpoNodo, rodape || document.createComment(''));
  janela.addEventListener('close', () => { janela.remove(); aoFechar?.(); });
  document.body.append(janela);
  janela.showModal();
  return { janela, fechar };
}

export function confirmar({ titulo, mensagem, rotuloConfirmar = 'Confirmar', perigo = false }) {
  return new Promise((resolve) => {
    let decidido = false;
    abrirModal({
      titulo,
      corpo: el('p', { texto: mensagem, style: 'font-size:1.05rem' }),
      accoes: [
        { rotulo: 'Cancelar', classe: 'btn--neutro', aoClicar: (fechar) => { fechar(); } },
        { rotulo: rotuloConfirmar, classe: perigo ? 'btn--perigo' : 'btn--principal',
          aoClicar: (fechar) => { decidido = true; fechar(); } },
      ],
      aoFechar: () => resolve(decidido),
    });
  });
}

/* -------------------------------------------------------------------------
   Descarregar ficheiros
   ------------------------------------------------------------------------- */

/**
 * Recebe um File (input file / câmara), redimensiona para caber num
 * quadrado de 400px e devolve um data URL JPEG (~15-30 kb).
 * Rejeita se a imagem não puder ser lida.
 */
export async function fotoParaMiniatura(file, ladoMax = 400, qualidade = 0.75) {
  if (!file || !file.type?.startsWith('image/')) throw new Error('Ficheiro não é uma imagem.');
  const dataUrl = await new Promise((resolver, rejeitar) => {
    const leitor = new FileReader();
    leitor.onload = () => resolver(leitor.result);
    leitor.onerror = () => rejeitar(new Error('Não foi possível ler o ficheiro.'));
    leitor.readAsDataURL(file);
  });
  const imagem = await new Promise((resolver, rejeitar) => {
    const im = new Image();
    im.onload = () => resolver(im);
    im.onerror = () => rejeitar(new Error('Não foi possível descodificar a imagem.'));
    im.src = dataUrl;
  });
  const escala = Math.min(1, ladoMax / Math.max(imagem.naturalWidth, imagem.naturalHeight));
  const largura = Math.round(imagem.naturalWidth * escala);
  const altura = Math.round(imagem.naturalHeight * escala);
  const canvas = document.createElement('canvas');
  canvas.width = largura; canvas.height = altura;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#fff'; // fundo branco para PNGs com transparência
  ctx.fillRect(0, 0, largura, altura);
  ctx.drawImage(imagem, 0, 0, largura, altura);
  return canvas.toDataURL('image/jpeg', qualidade);
}

export function descarregar(nomeFicheiro, conteudo, tipo = 'text/plain;charset=utf-8') {
  const blob = new Blob([conteudo], { type: tipo });
  const url = URL.createObjectURL(blob);
  const ligacao = el('a', { href: url, download: nomeFicheiro });
  document.body.append(ligacao);
  ligacao.click();
  ligacao.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}
