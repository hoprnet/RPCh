package main

import (
	"fmt"
	"log"
	"net/http"
)

func quotaAdd(response http.ResponseWriter, r *http.Request) {
	fmt.Println(123)
}

func main() {
	http.HandleFunc("/quota/add", quotaAdd)

	err := http.ListenAndServe("0.0.0.0:8080", nil)
	if err != nil {
		log.Fatal(err)
	}
}
