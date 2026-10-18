package applib

import (
	"context"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"

	"freelance-teacher/lib"
)

type testPath struct {
	Username string `schema:"username,required"`
}

type testQuery struct {
	Age int `schema:"age,omitempty"`
}

func TestDescriptorPattern(t *testing.T) {
	d := NewDescriptor(
		GET{},
		"/users/{username}/",
		SchemaPath[testPath](),
		SchemaQuery[testQuery](),
		NoBody(),
		StringResponse(),
	)

	if got, want := d.Pattern(), "GET /users/{username}/{$}"; got != want {
		t.Fatalf("Pattern() = %q; want %q", got, want)
	}
}

func TestDescriptorURL(t *testing.T) {
	d := NewDescriptor(
		GET{},
		"/users/{username}/",
		SchemaPath[testPath](),
		SchemaQuery[testQuery](),
		NoBody(),
		StringResponse(),
	)

	got, err := d.URL(
		testPath{Username: "alice/smith"},
		testQuery{Age: 42},
	)
	if err != nil {
		t.Fatalf("URL() error = %v", err)
	}

	const want = "/users/alice%2Fsmith/?age=42"
	if got.String() != want {
		t.Fatalf("URL() = %q; want %q", got.String(), want)
	}
}

func TestDescriptorHandlerDecodesRequest(t *testing.T) {
	d := NewDescriptor(
		GET{},
		"/users/{username}/",
		SchemaPath[testPath](),
		SchemaQuery[testQuery](),
		NoBody(),
		StringResponse(),
	)

	mux := http.NewServeMux()
	mux.Handle(d.Pattern(), d.Handler(
		func(_ context.Context, req Request[testPath, testQuery, lib.Empty]) (string, error) {
			return fmt.Sprintf("%s:%d", req.Path.Username, req.Query.Age), nil
		},
	))

	req := httptest.NewRequest(
		http.MethodGet,
		"/users/alice/?age=42",
		nil,
	)
	rec := httptest.NewRecorder()

	mux.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d; want %d; body = %q",
			rec.Code, http.StatusOK, rec.Body.String())
	}
	if got, want := rec.Body.String(), "alice:42"; got != want {
		t.Fatalf("body = %q; want %q", got, want)
	}
}
