import pug from "pug";
import type { PublicationResponse } from "@/server/types";
import { PicoCSS } from "@/server/views/pico.classless.min";

export const renderDetail = (
	publication: PublicationResponse,
	queryParams?: { page?: number; source?: string },
) => {
	const template = pug.compile(`
html
  head
    title Ethos - #{publication.title}
    style!= PicoCSS
  body
    header
      nav
        ul
          li
            - let backUrl = "/"
            - if (queryParams.page || queryParams.source) {
            -   backUrl += "?"
            -   let params = []
            -   if (queryParams.page) params.push("page=" + queryParams.page)
            -   if (queryParams.source) params.push("source=" + queryParams.source)
            -   backUrl += params.join("&")
            - }
            a(href=backUrl) ← Back to Publications
    main
      article.publication-detail
        h1= publication.title
        .meta
          if publication.author
            .author #{publication.author}
          if publication.publishedDate
            .date Published on #{new Date(publication.publishedDate).toLocaleDateString()}
          .source= publication.source
          .url
            a(href=publication.url target="_blank") View Original
        .content
          p!= publication.content
`);

	return template({
		publication,
		queryParams,
		PicoCSS,
	});
};
