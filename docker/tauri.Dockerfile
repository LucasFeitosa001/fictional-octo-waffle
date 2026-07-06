# Ambiente de build/dev do Tauri v2 (Silvia Hair ERP) — Rust + WebKitGTK + Node
FROM rust:1-bookworm

# Dependências de sistema do Tauri v2 no Linux
RUN apt-get update && apt-get install -y --no-install-recommends \
    libwebkit2gtk-4.1-dev \
    libgtk-3-dev \
    libayatana-appindicator3-dev \
    librsvg2-dev \
    libxdo-dev \
    libssl-dev \
    build-essential \
    curl \
    wget \
    file \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Node 22 (mesma major do host) + pnpm via corepack
RUN curl -fsSL https://deb.nodesource.com/setup_22.x | bash - \
    && apt-get install -y --no-install-recommends nodejs \
    && corepack enable \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
