-- Funções de gatilho não precisam ser chamáveis por ninguém (só o banco as dispara).
revoke all on function public.auditar_linha(), public.auditar_lote_ins(), public.auditar_lote_upd(), public.auditar_lote_del(), public.trava_edicao_fechada() from public, anon, authenticated;
comment on table public.quartos_link_edicao is 'Sem políticas de propósito: só é acessada pelas funções link_quartos, renovar_link_quartos, desligar_link_quartos e quartos_edicao_info.';
