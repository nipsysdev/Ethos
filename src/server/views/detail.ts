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
  body(style="max-width: 1152px;margin: auto;")
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
      article
        h1= publication.title
        div(role="group")
          div
            if publication.author
              div
                small #{publication.author}
              div
                small= publication.source
          if publication.publishedDate
            div(style="text-align: right;")
              small Published on #{new Date(publication.publishedDate).toLocaleDateString()}
        div
          a(href=publication.url target="_blank") View Original
        div
          p!= publication.content
`);

	return template({
		publication,
		queryParams,
		PicoCSS,
	});
};
