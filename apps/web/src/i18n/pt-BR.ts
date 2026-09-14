import type { CaseCategory, CaseStatus } from "@orbit-support/shared";

/** Customer-facing copy, Brazilian Portuguese first (PROJECT_CONTEXT.md §10.1). */
export const ptBR = {
  locale: "pt-BR",
  app: {
    title: "Orbit — Suporte",
    description: "Atendimento ao cliente Orbit: fale com o suporte e acompanhe seus pedidos.",
    simulationBadge: "Simulação",
    simulationNote:
      "Ambiente de desenvolvimento: a identidade e os dados do Orbit são simulados. Nada aqui é uma conta real.",
  },
  shell: {
    brand: "Orbit",
    tradingPlaceholder: "Área de negociação",
    tradingPlaceholderHint: "Espaço reservado para a interface do Orbit. O suporte fica ao lado, sem cobrir os controles de operação.",
    openSupport: "Suporte",
    closeSupport: "Fechar suporte",
    account: "Conta simulada",
  },
  support: {
    title: "Suporte",
    back: "Voltar",
    home: {
      talk: "Falar com o suporte",
      availability:
        "Atendimento feito por pessoas. Sua mensagem fica registrada com um número de referência e a resposta aparece aqui — mesmo se você fechar o painel.",
      active: "Conversas em andamento",
      previous: "Conversas anteriores",
      empty: "Você ainda não falou com o suporte.",
      loading: "Carregando suas conversas…",
      error: "Não foi possível carregar suas conversas.",
      retry: "Tentar novamente",
    },
    newRequest: {
      title: "Como podemos ajudar?",
      topic: "Assunto",
      message: "Conte o que está acontecendo",
      messageHint: "Não precisa informar seu ID ou e-mail: já sabemos quem você é.",
      send: "Enviar",
      sending: "Enviando…",
      error: "Não foi possível enviar. Verifique sua conexão e tente novamente.",
      validation: "Escolha um assunto e escreva sua mensagem.",
    },
    conversation: {
      reference: "Referência",
      you: "Você",
      support: "Suporte",
      system: "Aviso",
      composerLabel: "Sua mensagem",
      composerPlaceholder: "Escreva sua mensagem",
      send: "Enviar",
      sending: "Enviando…",
      failed: "Não enviada",
      retry: "Reenviar",
      loading: "Carregando conversa…",
      error: "Não foi possível carregar a conversa.",
      closedNotice: "Esta conversa foi encerrada. Para continuar, abra um novo pedido.",
      waitingNotice: "Recebemos sua mensagem. Uma pessoa da equipe vai responder por aqui.",
    },
  },
  status: {
    new: "Recebido",
    in_progress: "Em atendimento",
    waiting_customer: "Aguardando sua resposta",
    waiting_internal: "Em análise",
    resolved: "Resolvido",
    closed: "Encerrado",
  } satisfies Record<CaseStatus, string>,
  category: {
    deposits_withdrawals: "Depósitos e saques",
    operations: "Operações",
    account_verification: "Conta e verificação",
    bonuses_promotions: "Bônus e promoções",
    other: "Outro assunto",
  } satisfies Record<CaseCategory, string>,
} as const;

export type Dictionary = typeof ptBR;
