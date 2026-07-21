-- Belasis Etapa 2 — Central de Ajuda.
-- Artigos globais do produto carregados a partir de docs/help/*.md no boot
-- da API. Não multi-tenant (base de conhecimento é do SalonPass).
CREATE TABLE "HelpArticle" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "tags" TEXT[],
    "excerpt" TEXT NOT NULL,
    "icon" TEXT,
    "faq" BOOLEAN NOT NULL DEFAULT false,
    "body" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HelpArticle_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "HelpArticle_slug_key" ON "HelpArticle"("slug");
CREATE INDEX "HelpArticle_category_idx" ON "HelpArticle"("category");
CREATE INDEX "HelpArticle_faq_idx" ON "HelpArticle"("faq");
