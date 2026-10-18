package lib

import "fmt"

func Nil[T any]() (out T) {
	return
}

func Must[T any](value T, err error) T {
	if err != nil {
		panic(fmt.Sprintf("unexpected error: %s", err))
	}
	return value
}
