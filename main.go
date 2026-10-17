package main

import (
	"bytes"
	"fmt"
	"log"
	"net/http"
	"os"
	"time"

	"github.com/gomarkdown/markdown"
	"github.com/gomarkdown/markdown/html"
	"github.com/gomarkdown/markdown/parser"
	. "maragu.dev/gomponents"
	. "maragu.dev/gomponents/html"
)

func main() {
	mux := http.NewServeMux()

	mux.HandleFunc("GET /{$}", Wrap(HomePage))

	addr := ":3000"
	server := &http.Server{Addr: addr, Handler: LogRequests(mux)}

	log.Printf("[http] starting at %s", addr)

	if err := server.ListenAndServe(); err != nil {
		log.Printf("[http] server failed: %s", err)
		os.Exit(1)
	}
}

func HomePage(r *http.Request) (*Response, error) {
	md, err := os.ReadFile("home.md")
	if err != nil {
		return nil, fmt.Errorf("could not read home file: %w", err)
	}

	page := BaseLayout(
		"Home",
		Markdown(md),
	)

	return RespondPage(http.StatusOK, page)
}

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

// === utils(html) ===

func RespondPage(status int, page Node) (*Response, error) {
	res := &Response{
		code:   status,
		header: make(http.Header),
	}

	res.header.Set("Content-Type", "text/html; charset=utf-8")

	if err := Doctype(page).Render(&res.body); err != nil {
		return nil, err
	}

	return res, nil
}

func Markdown(source []byte) Node {
	extensions := parser.CommonExtensions | parser.AutoHeadingIDs | parser.NoEmptyLineBeforeBlock | parser.Footnotes
	p := parser.NewWithExtensions(extensions)
	doc := p.Parse(source)

	htmlFlags := html.CommonFlags | html.HrefTargetBlank | html.FootnoteReturnLinks
	opts := html.RendererOptions{Flags: htmlFlags, FootnoteReturnLinkContents: "↩"}
	renderer := html.NewRenderer(opts)

	return Raw(string(markdown.Render(doc, renderer)))
}

// === utils(http) ===

func Wrap(handler func(r *http.Request) (*Response, error)) func(http.ResponseWriter, *http.Request) {
	return func(w http.ResponseWriter, r *http.Request) {
		res, err := handler(r)

		if err != nil {
			log.Printf("[http] handling request: %s", err)
			http.Error(w, "Internal server error", http.StatusInternalServerError)
			return
		}

		if err := res.Write(w); err != nil {
			log.Printf("[http] writing response: %s", err)
		}
	}
}

type Response struct {
	code   int
	header http.Header
	body   bytes.Buffer
}

func (res *Response) Write(w http.ResponseWriter) error {
	for key, values := range res.header {
		w.Header()[key] = append([]string(nil), values...)
	}

	w.WriteHeader(res.code)

	_, err := res.body.WriteTo(w)

	return err
}

func LogRequests(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()
		sw := &statusWriter{ResponseWriter: w}

		next.ServeHTTP(sw, r)

		status := sw.status
		if status == 0 {
			status = http.StatusOK
		}

		log.Printf(
			"[http] %s %s %d (%s)",
			r.Method,
			r.URL.Path,
			status,
			time.Since(start),
		)
	})
}

type statusWriter struct {
	http.ResponseWriter
	status int
}

func (w *statusWriter) WriteHeader(status int) {
	if w.status == 0 {
		w.status = status
		w.ResponseWriter.WriteHeader(status)
	}
}

func (w *statusWriter) Write(p []byte) (int, error) {
	if w.status == 0 {
		w.WriteHeader(http.StatusOK)
	}
	return w.ResponseWriter.Write(p)
}
