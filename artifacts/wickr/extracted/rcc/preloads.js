~window.URL = class QURL extends URL {
  constructor(url, base) {
    super(url, base === 'qrc:' ? 'qrc:/' : base);
  }
}