--
-- PostgreSQL database dump
--

-- Dumped from database version 15.1 (Debian 15.1-1.pgdg110+1)
-- Dumped by pg_dump version 15.1 (Debian 15.1-1.pgdg110+1)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

SET default_table_access_method = heap;


--
-- Name: funding_requests; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.funding_requests (
    id serial NOT NULL,
    registered_node_id character varying(255) NOT NULL,
    request_id integer NOT NULL,
    amount text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.funding_requests OWNER TO postgres;

--
-- Name: clients; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TYPE public.payment_type AS ENUM ('trial', 'premium');

CREATE TABLE public.clients (
    id character varying(255) PRIMARY KEY,
    labels text[],
    payment public.payment_type NOT NULL,
    created_at timestamptz DEFAULT now() NOT NULL,
    updated_at timestamptz DEFAULT now() NOT NULL
);

ALTER TABLE public.clients OWNER TO postgres;

--
-- Name: quotas; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.quotas (
    id serial PRIMARY KEY,
    client_id character varying(255) NOT NULL,
    quota integer NOT NULL,
    action_taker character varying(255) NOT NULL,
    created_at timestamptz DEFAULT now() NOT NULL,
    updated_at timestamptz DEFAULT now() NOT NULL,
    CONSTRAINT quotas_client_id_fkey FOREIGN KEY (client_id)
        REFERENCES public.clients (id)
        ON DELETE CASCADE
);


ALTER TABLE public.quotas OWNER TO postgres;

--
-- Name: registered_nodes; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.registered_nodes (
    id character varying(255) NOT NULL,
    has_exit_node boolean DEFAULT false NOT NULL,
    chain_id integer NOT NULL,
    hoprd_api_endpoint character varying(255) NOT NULL,
    hoprd_api_token character varying(255) NOT NULL,
    exit_node_pub_key character varying(255),
    native_address character varying(255) NOT NULL,
    total_amount_funded numeric NOT NULL,
    honesty_score numeric NOT NULL,
    reason character varying(255),
    status character varying(255) NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.registered_nodes OWNER TO postgres;

--
-- Name: funding_requests funding_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.funding_requests
    ADD CONSTRAINT funding_requests_pkey PRIMARY KEY (id);

--
-- Name: registered_nodes registered_nodes_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.registered_nodes
    ADD CONSTRAINT registered_nodes_pkey PRIMARY KEY (id);

--
-- Name: funding_requests funding_requests_registered_node_id_fkey ; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.funding_requests
    ADD CONSTRAINT funding_requests_registered_node_id_fkey FOREIGN KEY (registered_node_id) REFERENCES public.registered_nodes(id);

--
-- PostgreSQL database dump complete
--
