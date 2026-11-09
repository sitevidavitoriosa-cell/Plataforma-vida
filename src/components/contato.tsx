/** Contato de emergência (texto livre da planilha) com atalho para o WhatsApp, se houver telefone. */
const RE = /(?:\+?55[\s.-]*)?\(?(\d{2})\)?[\s.-]*(9?\d{4})[\s.-]*(\d{4})/;

export function linkWhats(texto: string): string | null {
  const m = RE.exec(texto);
  return m ? `https://wa.me/55${m[1]}${m[2]}${m[3]}` : null;
}

export function ContatoLinha({ texto, className = "" }: { texto: string; className?: string }) {
  const url = linkWhats(texto);
  return (
    <div className={`flex items-center justify-between gap-3 ${className}`}>
      <span className="min-w-0 flex-1 text-[15px]">{texto}</span>
      {url && (
        <a href={url} target="_blank" rel="noopener noreferrer" aria-label="Chamar no WhatsApp"
          className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[#25D366] text-white">
          <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor" aria-hidden="true">
            <path d="M12.04 2a9.9 9.9 0 0 0-8.5 14.95L2 22l5.2-1.5A9.9 9.9 0 1 0 12.04 2Zm0 18.1c-1.5 0-2.9-.4-4.1-1.1l-.3-.2-3 .9.9-2.9-.2-.3a8.1 8.1 0 1 1 6.7 3.6Zm4.5-6c-.2-.1-1.5-.7-1.7-.8-.2-.1-.4-.1-.6.1-.2.2-.7.8-.8 1-.2.2-.3.2-.5.1-.8-.4-1.6-.8-2.3-1.6-.6-.6-1-1.2-1.2-1.6-.1-.2 0-.3.1-.5l.4-.4c.1-.1.1-.2.2-.4.1-.2 0-.3 0-.4s-.6-1.4-.8-1.9c-.2-.5-.4-.4-.6-.4h-.5c-.2 0-.4.1-.7.3-.2.2-.9.9-.9 2.200s.9 2.500 1.100 2.700c.1.200 1.900 2.900 4.600 4 .6.3 1.100.4 1.500.5.600.2 1.200.1 1.600.1.500-.1 1.500-.6 1.700-1.200.2-.6.2-1.100.1-1.200-.1-.1-.2-.2-.5-.3Z" />
          </svg>
        </a>
      )}
    </div>
  );
}
