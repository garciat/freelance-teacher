package lib

import (
	"log"
	"net/http"
	"time"
)

const (
	HeaderContentType = "Content-Type"
)

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

func (w *statusWriter) Unwrap() http.ResponseWriter {
	return w.ResponseWriter
}

func (w *statusWriter) WriteHeader(status int) {
	if w.status != 0 {
		return
	}

	// Informational responses do not determine the final status,
	// except 101 Switching Protocols.
	if status >= 100 &&
		status < 200 &&
		status != http.StatusSwitchingProtocols {
		w.ResponseWriter.WriteHeader(status)
		return
	}

	w.status = status
	w.ResponseWriter.WriteHeader(status)
}

func (w *statusWriter) Write(p []byte) (int, error) {
	if w.status == 0 {
		w.WriteHeader(http.StatusOK)
	}
	return w.ResponseWriter.Write(p)
}
