package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
)

// const DP_API_ENDPOINT = "http://discover-platform.discovery-platform:3020"
const DP_API_ENDPOINT = "http://localhost:9090"
const CLIENT = "sandbox"
const QUOTA = 1000

//const debug = NODE_ENV

func quotaAdd(response http.ResponseWriter, request *http.Request) {
	j, err := json.Marshal(map[string]string{
		"client": CLIENT,
		"quota":  string(rune(QUOTA)),
	})
	if err != nil {
		log.Fatal(err)
	}

	body := bytes.NewReader(j)

	fmt.Printf("%s%s", DP_API_ENDPOINT, "/api/client/funds")

	req, err := http.NewRequest(
		http.MethodPost,
		fmt.Sprintf("%s/%s", DP_API_ENDPOINT, "/api/client/funds"),
		body,
	)
	if err != nil {
		log.Fatal(err)
	}

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept-Content", "application/json")

	client := &http.Client{}
	resp, err := client.Do(req)
	if err != nil {
		log.Fatalln(err)
	}

	defer resp.Body.Close()

	b, err := io.ReadAll(resp.Body)
	if err != nil {
		log.Fatalln(err)
	}

	response.Write(b)
}

func main() {
	http.HandleFunc("/quota/add", quotaAdd)

	err := http.ListenAndServe("0.0.0.0:8080", nil)
	if err != nil {
		log.Fatal(err)
	}
}
