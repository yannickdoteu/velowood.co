export default {
  eleventyComputed: {
    lang: (data) => data.page_.lang,
    pageKey: (data) => `error/${data.page_.code}`,
    pageTitle: (data) => `${data.page_.lang.error.title} — velowood`,
    pageDescription: (data) => data.page_.lang.error.codes[data.page_.code],
  },
};
