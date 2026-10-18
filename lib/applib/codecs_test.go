package applib

import (
	"context"
	"net/http"
	"net/http/httptest"
	"net/url"
	"strings"
	"testing"

	"freelance-teacher/lib"
)

type testPayload struct {
	Name string `schema:"name,required" json:"name"`
}

func TestNoBodyCodec(t *testing.T) {
	codec := NoBody()

	t.Run("empty body", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodPost, "/", nil)

		if _, err := codec.DecodeBody(req); err != nil {
			t.Fatalf("DecodeBody() error = %v", err)
		}
	})

	t.Run("non-empty body", func(t *testing.T) {
		req := httptest.NewRequest(
			http.MethodPost, "/", strings.NewReader("x"),
		)

		if _, err := codec.DecodeBody(req); err == nil {
			t.Fatal("DecodeBody() succeeded; want error")
		}
	})
}

func TestQueryCodecs(t *testing.T) {
	t.Run("NoQuery accepts empty query", func(t *testing.T) {
		if _, err := NoQuery().DecodeQuery(url.Values{}); err != nil {
			t.Fatalf("DecodeQuery() error = %v", err)
		}
	})

	t.Run("NoQuery rejects parameters", func(t *testing.T) {
		values := url.Values{"unexpected": {"1"}}

		if _, err := NoQuery().DecodeQuery(values); err == nil {
			t.Fatal("DecodeQuery() succeeded; want error")
		}
	})

	t.Run("IgnoreQuery accepts parameters", func(t *testing.T) {
		values := url.Values{"unexpected": {"1"}}

		if _, err := IgnoreQuery().DecodeQuery(values); err != nil {
			t.Fatalf("DecodeQuery() error = %v", err)
		}
	})
}

func TestJSONBodyCodec(t *testing.T) {
	codec := JsonBodyCodec[testPayload]{}

	t.Run("valid JSON", func(t *testing.T) {
		req := httptest.NewRequest(
			http.MethodPost, "/", strings.NewReader(`{"name":"Ada"}`),
		)
		req.Header.Set("Content-Type", "application/json")

		got, err := codec.DecodeBody(req)
		if err != nil {
			t.Fatalf("DecodeBody() error = %v", err)
		}
		if got.Name != "Ada" {
			t.Fatalf("Name = %q; want %q", got.Name, "Ada")
		}
	})

	t.Run("rejects multiple JSON values", func(t *testing.T) {
		req := httptest.NewRequest(
			http.MethodPost, "/",
			strings.NewReader(`{"name":"Ada"} {"name":"Bob"}`),
		)
		req.Header.Set("Content-Type", "application/json")

		if _, err := codec.DecodeBody(req); err == nil {
			t.Fatal("DecodeBody() succeeded; want error")
		}
	})

	t.Run("rejects wrong content type", func(t *testing.T) {
		req := httptest.NewRequest(
			http.MethodPost, "/", strings.NewReader(`{"name":"Ada"}`),
		)
		req.Header.Set("Content-Type", "text/plain")

		if _, err := codec.DecodeBody(req); err == nil {
			t.Fatal("DecodeBody() succeeded; want error")
		}
	})
}

func TestFormBodyCodec(t *testing.T) {
	codec := FormBody[testPayload]()

	t.Run("valid form", func(t *testing.T) {
		req := httptest.NewRequest(
			http.MethodPost, "/", strings.NewReader("name=Ada"),
		)
		req.Header.Set(
			"Content-Type",
			"application/x-www-form-urlencoded",
		)

		got, err := codec.DecodeBody(req)
		if err != nil {
			t.Fatalf("DecodeBody() error = %v", err)
		}
		if got.Name != "Ada" {
			t.Fatalf("Name = %q; want %q", got.Name, "Ada")
		}
	})

	t.Run("rejects wrong content type", func(t *testing.T) {
		req := httptest.NewRequest(
			http.MethodPost, "/", strings.NewReader("name=Ada"),
		)
		req.Header.Set("Content-Type", "text/plain")

		if _, err := codec.DecodeBody(req); err == nil {
			t.Fatal("DecodeBody() succeeded; want error")
		}
	})
}

func TestOversizedFormReturns413(t *testing.T) {
	d := NewDescriptor(
		POST{},
		"/",
		SchemaPath[lib.Empty](),
		NoQuery(),
		FormBody[testPayload](),
		StringResponse(),
	)

	mux := http.NewServeMux()
	mux.Handle(d.Pattern(), d.Handler(
		func(_ context.Context, req Request[lib.Empty, lib.Empty, testPayload]) (string, error) {
			return req.Body.Name, nil
		},
	))

	handler := http.MaxBytesHandler(mux, 5)

	req := httptest.NewRequest(
		http.MethodPost, "/", strings.NewReader("name=too-long"),
	)
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	rec := httptest.NewRecorder()

	handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusRequestEntityTooLarge {
		t.Fatalf("status = %d; want %d; body = %q",
			rec.Code, http.StatusRequestEntityTooLarge, rec.Body.String())
	}
}
