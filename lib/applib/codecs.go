package applib

import (
	"bytes"
	"encoding/json"
	"fmt"
	"freelance-teacher/lib"
	"io"
	"mime"
	"net/http"
	"net/url"

	"github.com/gorilla/schema"
	"maragu.dev/gomponents"
	"maragu.dev/gomponents/html"
)

type PathCodec[T any] interface {
	DecodePath(FlatValues) (T, error)

	EncodePath(T) (FlatValues, error)
}

type QueryCodec[T any] interface {
	DecodeQuery(url.Values) (T, error)

	EncodeQuery(T) (url.Values, error)
}

type BodyCodec[T any] interface {
	DecodeBody(*http.Request) (T, error)
}

type ResponseCodec[T any] interface {
	EncodeResponse(http.ResponseWriter, T) error
}

type HttpMethodType interface {
	HttpMethod() string
}

func SchemaPath[T any]() PathCodec[T] {
	return SchemaPathCodec[T]{
		decoder: schema.NewDecoder(),
		encoder: schema.NewEncoder(),
	}
}

func SchemaQuery[T any]() QueryCodec[T] {
	return SchemaQueryCodec[T]{
		decoder: schema.NewDecoder(),
		encoder: schema.NewEncoder(),
	}
}

func IgnoreQuery() QueryCodec[lib.Empty] {
	return IgnoreQueryCodec[lib.Empty]{}
}

func NoQuery() QueryCodec[lib.Empty] {
	return NoQueryCodec[lib.Empty]{}
}

func NoBody() BodyCodec[lib.Empty] {
	return NoBodyCodec[lib.Empty]{}
}

func JsonBody[T any]() BodyCodec[T] {
	return JsonBodyCodec[T]{}
}

func FormBody[T any]() BodyCodec[T] {
	return FormBodyCodec[T]{
		decoder: schema.NewDecoder(),
	}
}

func HtmlResponse() ResponseCodec[gomponents.Node] {
	return HtmlResponseCodec{}
}

func JsonResponse[T any]() ResponseCodec[T] {
	return JsonResponseCodec[T]{}
}

func StringResponse() ResponseCodec[string] {
	return StringResponseCodec{}
}

type SchemaPathCodec[T any] struct {
	decoder *schema.Decoder
	encoder *schema.Encoder
}

func (c SchemaPathCodec[T]) DecodePath(values FlatValues) (T, error) {
	var out T
	if err := c.decoder.Decode(&out, values.Unflatten()); err != nil {
		return lib.Nil[T](), fmt.Errorf("decoding typed path: %w", err)
	}
	return out, nil
}

func (c SchemaPathCodec[T]) EncodePath(path T) (FlatValues, error) {
	values := url.Values{}
	if err := c.encoder.Encode(path, values); err != nil {
		return nil, fmt.Errorf("encoding typed path: %w", err)
	}
	return FlattenValues(values)
}

type SchemaQueryCodec[T any] struct {
	decoder *schema.Decoder
	encoder *schema.Encoder
}

func (c SchemaQueryCodec[T]) DecodeQuery(values url.Values) (T, error) {
	var out T
	if err := c.decoder.Decode(&out, values); err != nil {
		return lib.Nil[T](), fmt.Errorf("decoding typed query: %w", err)
	}
	return out, nil
}

func (c SchemaQueryCodec[T]) EncodeQuery(path T) (url.Values, error) {
	values := url.Values{}
	if err := c.encoder.Encode(path, values); err != nil {
		return nil, fmt.Errorf("encoding typed query: %w", err)
	}
	return values, nil
}

type IgnoreQueryCodec[T any] struct{}

func (IgnoreQueryCodec[T]) DecodeQuery(url.Values) (T, error) {
	return lib.Nil[T](), nil
}

func (IgnoreQueryCodec[T]) EncodeQuery(T) (url.Values, error) {
	return url.Values{}, nil
}

type NoQueryCodec[T any] struct{}

func (NoQueryCodec[T]) DecodeQuery(values url.Values) (T, error) {
	if len(values) != 0 {
		return lib.Nil[T](), fmt.Errorf("expected no query parameters")
	}
	return lib.Nil[T](), nil
}

func (NoQueryCodec[T]) EncodeQuery(T) (url.Values, error) {
	return url.Values{}, nil
}

type NoBodyCodec[T any] struct{}

func (NoBodyCodec[T]) DecodeBody(r *http.Request) (T, error) {
	var buf [1]byte

	n, err := io.ReadFull(r.Body, buf[:])
	if err == io.EOF {
		return lib.Nil[T](), nil
	}
	if err != nil {
		return lib.Nil[T](), fmt.Errorf("checking request body: %w", err)
	}
	if n > 0 {
		return lib.Nil[T](), fmt.Errorf("expected empty body")
	}

	return lib.Nil[T](), nil
}

type JsonBodyCodec[T any] struct{}

func (JsonBodyCodec[T]) DecodeBody(r *http.Request) (T, error) {
	if err := checkContentType(r, "application/json"); err != nil {
		return lib.Nil[T](), err
	}

	decoder := json.NewDecoder(r.Body)

	var out T
	if err := decoder.Decode(&out); err != nil {
		return lib.Nil[T](), fmt.Errorf("decoding json: %w", err)
	}

	var ignore any
	if err := decoder.Decode(&ignore); err != io.EOF {
		if err == nil {
			return out, fmt.Errorf("expected exactly one JSON value")
		}
		return out, fmt.Errorf("checking trailing JSON: %w", err)
	}

	return out, nil
}

type FormBodyCodec[T any] struct {
	decoder *schema.Decoder
}

func (c FormBodyCodec[T]) DecodeBody(r *http.Request) (T, error) {
	if err := checkContentType(r, "application/x-www-form-urlencoded"); err != nil {
		return lib.Nil[T](), err
	}

	if err := r.ParseForm(); err != nil {
		return lib.Nil[T](), fmt.Errorf("parsing form: %w", err)
	}

	var out T

	if err := c.decoder.Decode(&out, r.PostForm); err != nil {
		return lib.Nil[T](), fmt.Errorf("decoding form values: %w", err)
	}

	return out, nil
}

type JsonResponseCodec[T any] struct{}

func (JsonResponseCodec[T]) EncodeResponse(w http.ResponseWriter, value T) error {
	var buf bytes.Buffer

	if err := json.NewEncoder(&buf).Encode(value); err != nil {
		return fmt.Errorf("encoding JSON response: %w", err)
	}

	w.Header().Set(lib.HeaderContentType, "application/json")
	w.WriteHeader(http.StatusOK)

	_, err := buf.WriteTo(w)
	return err
}

type StringResponseCodec struct{}

func (StringResponseCodec) EncodeResponse(w http.ResponseWriter, value string) error {
	w.Header().Set(lib.HeaderContentType, "text/plain; charset=utf-8")
	w.WriteHeader(http.StatusOK)
	_, err := w.Write([]byte(value))
	return err
}

type HtmlResponseCodec struct{}

func (HtmlResponseCodec) EncodeResponse(w http.ResponseWriter, page gomponents.Node) error {
	var buf bytes.Buffer

	if err := html.Doctype(page).Render(&buf); err != nil {
		return fmt.Errorf("rendering html: %w", err)
	}

	w.Header().Set(lib.HeaderContentType, "text/html; charset=utf-8")
	w.WriteHeader(http.StatusOK)

	_, err := buf.WriteTo(w)
	return err
}

func checkContentType(r *http.Request, expected string) error {
	mediaType, _, err := mime.ParseMediaType(r.Header.Get(lib.HeaderContentType))
	if err != nil {
		return fmt.Errorf("parsing media type: %w", err)
	}
	if mediaType != expected {
		return fmt.Errorf("expected content type: %s", expected)
	}
	return nil
}
