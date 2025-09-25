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
body
  header
    nav
      ul
        li
          strong
            a(href="/", aria-label="Home") Ethos
  main
    h1 Publications
    .filter-container
      form(method="get", action="/")
        label(for="source") Filter by source:
        select#source(name="source", onchange="this.form.submit()")
          option(value="") All Sources
          each src in sources
            option(value=src.id, selected=currentSource === src.id)= src.name
    if publications.length > 0
      .grid
        each publication in publications
          article
            h2
              - let articleUrl = \`/\${publication.hash}\`
              - if (currentSource || pagination.page > 1) {
              -   articleUrl += "?"
              -   let params = []
              -   if (pagination.page > 1) params.push("page=" + pagination.page)
              -   if (currentSource) params.push("source=" + currentSource)
              -   articleUrl += params.join("&")
              - }
              a(href=articleUrl)= publication.title
            .meta
              if publication.author
                small By #{publication.author}
              if publication.publishedDate
                small= new Date(publication.publishedDate).toLocaleDateString()
              small= publication.source
            .content
              p!= publication.content
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
      .container
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
