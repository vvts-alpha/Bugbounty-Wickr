interface MarkdownParseRuleConfig {
  marker: string; // '*' or '~'
  tokenOpen: string; // 'strong_open' or 's_open'
  tokenClose: string; // 'strong_close' or 's_close'
  tokenTag: string; // 'strong' or 's'
  ruleName: string; // 'custom_bold' or 'custom_strike'
  beforeRule: string; // 'emphasis' or 'strikethrough'
}

export function alwaysTreatDoubleMarkerAsMarkdown(config: MarkdownParseRuleConfig) {
  return function setup(md: any) {
    md.inline.ruler.before(config.beforeRule, config.ruleName, (state: any, silent: any) => {
      const start = state.pos;
      const src = state.src;

      // Check for opening markers
      if (src[start] != config.marker || src[start + 1] != config.marker) return false;
      const max = state.posMax;
      let pos = start + 2;

      // Find closing markers
      while (pos < max - 1) {
        if (src[pos] === config.marker && src[pos + 1] === config.marker) {
          break;
        }
        pos++;
      }

      if (pos >= max - 1) return false;

      if (!silent) {
        const token_o = state.push(config.tokenOpen, config.tokenTag, 1);
        token_o.markup = config.marker + config.marker;

        // Parse the content between the markers
        const oldPos = state.pos;
        const oldPosMax = state.posMax;
        state.pos = start + 2;
        state.posMax = pos;
        state.md.inline.tokenize(state);
        state.pos = oldPos;
        state.posMax = oldPosMax;

        const token_c = state.push(config.tokenClose, config.tokenTag, -1);
        token_c.markup = config.marker + config.marker;
      }

      state.pos = pos + 2;
      return true;
    });
  };
}
