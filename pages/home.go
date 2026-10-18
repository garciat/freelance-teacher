package pages

import (
	"context"
	"freelance-teacher/lib"
	"freelance-teacher/lib/applib"
	"net/http"

	"maragu.dev/gomponents"
	. "maragu.dev/gomponents"
	. "maragu.dev/gomponents/html"
)

var RouteGetHome = applib.NewDescriptor(
	applib.GET{},
	"/",
	applib.SchemaPath[lib.Empty](),
	applib.NoQuery(),
	applib.NoBody(),
	applib.HtmlResponse(),
)

type HomeBody struct {
	Name string `schema:"name,required"`
}

var RoutePostHome = applib.NewDescriptor(
	applib.POST{},
	"/",
	applib.SchemaPath[lib.Empty](),
	applib.NoQuery(),
	applib.FormBody[HomeBody](),
	applib.HtmlResponse(),
)

func RegisterHomeRoutes(mux *http.ServeMux) {
	mux.Handle(
		RouteGetHome.Pattern(),
		RouteGetHome.Handler(
			func(_ context.Context, req applib.Request[lib.Empty, lib.Empty, lib.Empty]) (gomponents.Node, error) {
				return HomePage()
			},
		),
	)

	mux.Handle(
		RoutePostHome.Pattern(),
		RoutePostHome.Handler(
			func(_ context.Context, req applib.Request[lib.Empty, lib.Empty, HomeBody]) (gomponents.Node, error) {
				return PostHomePage(req.Body)
			},
		),
	)
}

func HomePage() (Node, error) {
	return BaseLayout(
		"Home",
		H1(Text("Home")),
		Form(
			Method("POST"),
			Action(RoutePostHome.MustURL(lib.Empty{}, lib.Empty{}).String()),
			Input(
				Type("text"),
				Name("name"),
				Required(),
			),
			Input(
				Type("submit"),
				Value("Submit"),
			),
		),
	), nil
}

func PostHomePage(body HomeBody) (Node, error) {
	return BaseLayout(
		"Home",
		H1(Text("Home")),
		Textf("Name: %s", body.Name),
	), nil
}
