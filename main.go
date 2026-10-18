package main

import (
	"freelance-teacher/lib"
	"freelance-teacher/pages"
	"log"
	"net/http"
	"os"
	"time"
)

func main() {
	mux := http.NewServeMux()

	pages.RegisterHomeRoutes(mux)

	var handler http.Handler
	handler = mux
	handler = http.TimeoutHandler(handler, 10*time.Second, "")
	handler = lib.LogRequests(handler)
	handler = http.MaxBytesHandler(handler, 1*1024*1024)

	addr := ":3000"
	server := &http.Server{
		Addr:              addr,
		Handler:           handler,
		IdleTimeout:       60 * time.Second,
		ReadHeaderTimeout: 5 * time.Second,
		ReadTimeout:       5 * time.Second,
		WriteTimeout:      10 * time.Second,
	}

	log.Printf("[http] starting at %s", addr)

	if err := server.ListenAndServe(); err != nil {
		log.Printf("[http] server failed: %s", err)
		os.Exit(1)
	}
}
