package applib

import (
	"fmt"
	"net/url"
	"strings"
)

func patternReplace(path string, values FlatValues) (string, error) {
	segments := strings.Split(path, "/")

	for i, segment := range segments {
		if len(segment) == 0 {
			continue
		}

		if segment[0] == '{' && segment[len(segment)-1] == '}' {
			name := segment[1 : len(segment)-1]

			value, ok := values[name]
			if !ok {
				return "", fmt.Errorf("missing value: %s", name)
			}
			if value == "" {
				return "", fmt.Errorf("empty value: %s", name)
			}

			segments[i] = url.PathEscape(value)
		}
	}

	return strings.Join(segments, "/"), nil
}

func patternVariables(path string) []string {
	segments := strings.Split(path, "/")

	var variables []string

	for _, segment := range segments {
		if len(segment) == 0 {
			continue
		}

		if segment[0] == '{' && segment[len(segment)-1] == '}' {
			variables = append(variables, segment[1:len(segment)-1])
		}
	}

	return variables
}
