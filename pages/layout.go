package pages

import (
	. "maragu.dev/gomponents"
	. "maragu.dev/gomponents/html"
)

func BaseLayout(title string, body ...Node) Node {
	return HTML(
		Lang("en"),
		Head(
			Meta(Charset("utf-8")),
			TitleEl(Text(title)),
		),
		Body(body...),
	)
}
