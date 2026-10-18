package applib

import (
	"fmt"
	"net/url"
)

type FlatValues map[string]string

func (f FlatValues) Set(name string, s string) {
	f[name] = s
}

func (f FlatValues) Get(s string) string {
	return f[s]
}

func (f FlatValues) Unflatten() url.Values {
	out := url.Values{}

	for name, value := range f {
		out.Set(name, value)
	}

	return out
}

func FlattenValues(values url.Values) (FlatValues, error) {
	out := FlatValues{}

	for name, values := range values {
		switch len(values) {
		case 0:
			out[name] = ""
		case 1:
			out[name] = values[0]
		default:
			return nil, fmt.Errorf("more than one value for name: %s", name)
		}
	}

	return out, nil
}
