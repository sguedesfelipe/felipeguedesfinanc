// Paleta do redesign "Grana" — prefixo --g- em todo token novo pra nunca
// colidir com as variaveis antigas (--surface-1, --page, --text-primary,
// --good, --warn, --border, etc.) que o conteudo ainda nao migrado de cada
// aba continua usando enquanto as fases B-E vao substituindo aba por aba.
export const DESIGN_TOKENS_CSS = `
  :root {
    --g-paper:       #F4F6F3;
    --g-card:        #FFFFFF;
    --g-card-2:      #EEF1EC;
    --g-hero-bg:     #10171A;
    --g-hero-text:   #F2F5F3;
    --g-text-1:      #0F1614;
    --g-text-2:      #55655F;
    --g-text-3:      #8B9A93;
    --g-border:      rgba(15,22,20,0.08);
    --g-accent:      #00A99A;
    --g-accent-ink:  #003E38;
    --g-accent-soft: #D8F1EC;
    --g-good:        #2E9E4F;
    --g-good-soft:   #E4F5E8;
    --g-warn:        #C1701C;
    --g-warn-soft:   #FBEBDA;
    --g-shadow-1:    0 1px 2px rgba(16,23,26,0.04), 0 8px 24px -12px rgba(16,23,26,0.18);
    --g-shadow-2:    0 20px 60px -20px rgba(16,23,26,0.45);
  }
  @media (prefers-color-scheme: dark) {
    :root {
      --g-paper:       #0A0F0E;
      --g-card:        #131A19;
      --g-card-2:      #1A2220;
      --g-hero-bg:     #1C2725;
      --g-hero-text:   #F2F5F3;
      --g-text-1:      #F2F5F3;
      --g-text-2:      #9CACA5;
      --g-text-3:      #667670;
      --g-border:      rgba(255,255,255,0.08);
      --g-accent:      #2BD8C7;
      --g-accent-ink:  #05221E;
      --g-accent-soft: #0F3B36;
      --g-good:        #4FC373;
      --g-good-soft:   #123322;
      --g-warn:        #E7A15C;
      --g-warn-soft:   #3A2716;
      --g-shadow-1:    0 1px 2px rgba(0,0,0,0.3), 0 8px 24px -12px rgba(0,0,0,0.5);
      --g-shadow-2:    0 20px 60px -20px rgba(0,0,0,0.8);
    }
  }
`;
