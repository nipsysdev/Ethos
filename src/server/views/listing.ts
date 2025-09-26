import pug from "pug";
import type { PublicationResponse } from "@/server/types";
import type { PaginationMeta } from "@/server/utils/pagination";
import { PicoCSS } from "@/server/views/pico.classless.min";

export const renderListing = (
	publications: PublicationResponse[],
	pagination: PaginationMeta,
	sources: { id: string; name: string }[],
	currentSource?: string,
) => {
	const template = pug.compile(`
html
head
  title Ethos - Publications
  style!= PicoCSS
body(style="max-width: 1152px;margin: auto;")
  header
    nav
      ul
        li
          strong
            a(href="/", aria-label="Home") Ethos
  main
    h1 Publications
    div
      form(method="get", action="/")
        label(for="source") Filter by source:
        select#source(name="source", onchange="this.form.submit()")
          option(value="") All Sources
          each src in sources
            option(value=src.id, selected=currentSource === src.id)= src.name
    if publications.length > 0
      div
        each publication in publications
          article
            h3
              - let articleUrl = \`/\${publication.hash}\`
              - if (currentSource || pagination.page > 1) {
              -   articleUrl += "?"
              -   let params = []
              -   if (pagination.page > 1) params.push("page=" + pagination.page)
              -   if (currentSource) params.push("source=" + currentSource)
              -   articleUrl += params.join("&")
              - }
              a(href=articleUrl)= publication.title
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
            div(style="line-height: 1.5em; height: 4.5em; overflow: hidden;")
              p!= publication.content
            div(style="text-align: right;")
              a(href=articleUrl, role="button", aria-label="Read more about #{publication.title}") Continue reading
      
      nav(role="navigation", aria-label="Pagination navigation")
        ul
          if pagination.page > 1
            li
              a(href=\`/?page=\${pagination.page - 1}${currentSource ? "&source=" + currentSource : ""}\`, rel="prev") Previous
          li
            span Page #{pagination.page} of #{pagination.totalPages}
          if pagination.page < pagination.totalPages
            li
              a(href=\`/?page=\${pagination.page + 1}${currentSource ? "&source=" + currentSource : ""}\`, rel="next") Next
    else
      div
        p No publications found.
`);

	return template({
		publications,
		pagination,
		sources,
		currentSource,
		PicoCSS,
	});
};
