package applib

import (
	"context"
	"errors"
	"fmt"
	"freelance-teacher/lib"
	"log"
	"net/http"
	"net/url"
	"strings"
)

type GET struct{}

func (GET) HttpMethod() string {
	return "GET"
}

type POST struct{}

func (POST) HttpMethod() string {
	return "POST"
}

type Descriptor[M HttpMethodType, P, Q, B, R any] struct {
	Method M
	// Path expects an exact match, supporting basic variable segmetns like {x}
	Path          string
	PathCodec     PathCodec[P]
	QueryCodec    QueryCodec[Q]
	BodyCodec     BodyCodec[B]
	ResponseCodec ResponseCodec[R]
}

type Request[P, Q, B any] struct {
	Path  P
	Query Q
	Body  B
}

func NewDescriptor[M HttpMethodType, P, Q, B, R any](
	method M,
	pattern string,
	pathCodec PathCodec[P],
	queryCodec QueryCodec[Q],
	bodyCodec BodyCodec[B],
	responseCodec ResponseCodec[R],
) Descriptor[M, P, Q, B, R] {
	return Descriptor[M, P, Q, B, R]{
		Method:        method,
		Path:          pattern,
		PathCodec:     pathCodec,
		QueryCodec:    queryCodec,
		BodyCodec:     bodyCodec,
		ResponseCodec: responseCodec,
	}
}

func (d Descriptor[M, P, Q, B, R]) MustURL(path P, query Q) *url.URL {
	return lib.Must(d.URL(path, query))
}

func (d Descriptor[M, P, Q, B, R]) Pattern() string {
	pat := fmt.Sprintf("%s %s", d.Method.HttpMethod(), d.Path)
	if strings.HasSuffix(d.Path, "/") {
		pat += "{$}"
	}
	return pat
}

func (d Descriptor[M, P, Q, B, R]) URL(path P, query Q) (*url.URL, error) {
	pathValues, err := d.PathCodec.EncodePath(path)
	if err != nil {
		return nil, fmt.Errorf("encoding path for url: %w", err)
	}

	queryValues, err := d.QueryCodec.EncodeQuery(query)
	if err != nil {
		return nil, fmt.Errorf("encoding query for url: %w", err)
	}

	pathString, err := patternReplace(d.Path, pathValues)
	if err != nil {
		return nil, fmt.Errorf("replacing path variables for url: %w", err)
	}

	url, err := url.Parse(pathString)
	if err != nil {
		return nil, fmt.Errorf("building url: %w", err)
	}

	url.RawQuery = queryValues.Encode()

	return url, nil
}

func (d Descriptor[M, P, Q, B, R]) Handler(f func(ctx context.Context, req Request[P, Q, B]) (R, error)) http.Handler {
	variables := patternVariables(d.Path)

	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		pathValues := FlatValues{}

		for _, name := range variables {
			pathValues.Set(name, r.PathValue(name))
		}

		path, err := d.PathCodec.DecodePath(pathValues)

		if err != nil {
			http.Error(w, "Bad request: path", http.StatusBadRequest)
			return
		}

		queryValues, err := url.ParseQuery(r.URL.RawQuery)
		if err != nil {
			http.Error(w, "Bad request: query", http.StatusBadRequest)
			return
		}

		query, err := d.QueryCodec.DecodeQuery(queryValues)

		if err != nil {
			http.Error(w, "Bad request: query", http.StatusBadRequest)
			return
		}

		body, err := d.BodyCodec.DecodeBody(r)

		var maxBytesErr *http.MaxBytesError

		switch {
		case errors.As(err, &maxBytesErr):
			http.Error(w, "Request body too large", http.StatusRequestEntityTooLarge)
			return
		case err != nil:
			http.Error(w, "Bad request: body", http.StatusBadRequest)
			return
		}

		req := Request[P, Q, B]{
			Path:  path,
			Query: query,
			Body:  body,
		}

		result, err := f(r.Context(), req)

		if err != nil {
			log.Printf("[ERROR] 	handling request: %s", err)
			http.Error(w, "Internal server error", http.StatusInternalServerError)
			return
		}

		err = d.ResponseCodec.EncodeResponse(w, result)

		if err != nil {
			log.Printf("[ERROR] encoding response: %s", err)
			return
		}
	})
}
