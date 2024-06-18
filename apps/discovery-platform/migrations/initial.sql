CREATE FUNCTION public.process_initial_monthly_usage() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
    BEGIN
        INSERT INTO monthly_quota_usages (user_id, started_at, req_count, resp_count, req_segment_count, resp_segment_count) VALUES (NEW.id, NEW.created_at, 0, 0, 0, 0);
        RETURN NULL;
    END;
    $$;


ALTER FUNCTION public.process_initial_monthly_usage() OWNER TO postgres;

CREATE FUNCTION public.process_monthly_usage() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
    BEGIN
        IF (TG_TABLE_NAME = 'request_quotas') THEN
            UPDATE monthly_quota_usages SET (req_count, req_segment_count) = (1 + req_count, NEW.segment_count + req_segment_count) WHERE user_id = (SELECT user_id FROM clients WHERE id = NEW.client_id);
        ELSEIF (TG_TABLE_NAME = 'response_quotas') THEN
            UPDATE monthly_quota_usages SET (resp_count, resp_segment_count) = (1 + resp_count, NEW.segment_count + resp_segment_count) WHERE user_id = (SELECT user_id FROM clients WHERE id = NEW.client_id);
        END IF;
        RETURN NULL;
    END;
    $$;


ALTER FUNCTION public.process_monthly_usage() OWNER TO postgres;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: associated_nodes; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.associated_nodes (
    user_id uuid NOT NULL,
    node_id character varying(255) NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.associated_nodes OWNER TO postgres;

--
-- Name: billing_schemes; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.billing_schemes (
    id uuid NOT NULL,
    name character varying(255) NOT NULL,
    "desc" character varying(255),
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp without time zone
);


ALTER TABLE public.billing_schemes OWNER TO postgres;

--
-- Name: boomfi_packages; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.boomfi_packages (
    boomfi_package_id character varying(255) NOT NULL,
    package_id uuid NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.boomfi_packages OWNER TO postgres;

--
-- Name: chain_credentials; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.chain_credentials (
    user_id uuid NOT NULL,
    address character varying(255) NOT NULL,
    chain character varying(255) NOT NULL
);


ALTER TABLE public.chain_credentials OWNER TO postgres;

--
-- Name: clients; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.clients (
    id uuid NOT NULL,
    user_id uuid NOT NULL,
    external_token character varying(255) NOT NULL,
    invalidated_at timestamp without time zone,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp without time zone,
    name character varying(255),
    CONSTRAINT external_token_check CHECK ((char_length((external_token)::text) >= 10))
);


ALTER TABLE public.clients OWNER TO postgres;

--
-- Name: configs; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.configs (
    key character varying(255) NOT NULL,
    data text NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp without time zone
);


ALTER TABLE public.configs OWNER TO postgres;

--
-- Name: degen_sessions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.degen_sessions (
    sid character varying(255) NOT NULL,
    sess json NOT NULL,
    expire timestamp(6) without time zone NOT NULL
);


ALTER TABLE public.degen_sessions OWNER TO postgres;

--
-- Name: exit_node_tokens; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.exit_node_tokens (
    id uuid NOT NULL,
    exit_id character varying(255) NOT NULL,
    access_token character varying(255) NOT NULL,
    invalidated_at timestamp without time zone,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp without time zone
);


ALTER TABLE public.exit_node_tokens OWNER TO postgres;

--
-- Name: federated_credentials; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.federated_credentials (
    id uuid NOT NULL,
    user_id uuid NOT NULL,
    provider character varying(255) NOT NULL,
    subject character varying(255) NOT NULL
);


ALTER TABLE public.federated_credentials OWNER TO postgres;

--
-- Name: monthly_quota_usage_histories; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.monthly_quota_usage_histories (
    id uuid NOT NULL,
    user_id uuid NOT NULL,
    started_at timestamp without time zone NOT NULL,
    ended_at timestamp without time zone NOT NULL,
    req_count integer NOT NULL,
    resp_count integer NOT NULL,
    req_segment_count integer NOT NULL,
    resp_segment_count integer NOT NULL
);


ALTER TABLE public.monthly_quota_usage_histories OWNER TO postgres;

--
-- Name: monthly_quota_usages; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.monthly_quota_usages (
    user_id uuid NOT NULL,
    started_at timestamp without time zone NOT NULL,
    req_count integer NOT NULL,
    resp_count integer NOT NULL,
    req_segment_count integer,
    resp_segment_count integer
);


ALTER TABLE public.monthly_quota_usages OWNER TO postgres;

--
-- Name: one_hop_pairings; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.one_hop_pairings (
    entry_id character varying(255) NOT NULL,
    exit_id character varying(255) NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.one_hop_pairings OWNER TO postgres;

--
-- Name: packages; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.packages (
    id uuid NOT NULL,
    name character varying(255) NOT NULL,
    "desc" character varying(255),
    billing_scheme_id uuid,
    alternative_billing_scheme_id uuid,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp without time zone,
    segment_count_per_month integer NOT NULL
);


ALTER TABLE public.packages OWNER TO postgres;

--
-- Name: redeemed_vouchers; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.redeemed_vouchers (
    user_id uuid NOT NULL,
    voucher_id uuid NOT NULL,
    "createdAt" timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.redeemed_vouchers OWNER TO postgres;

--
-- Name: registered_nodes; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.registered_nodes (
    id character varying(255) NOT NULL,
    is_exit_node boolean NOT NULL,
    chain_id integer NOT NULL,
    hoprd_api_endpoint character varying(255) NOT NULL,
    hoprd_api_token character varying(255) NOT NULL,
    exit_node_pub_key character varying(255),
    native_address character varying(255) NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp without time zone
);


ALTER TABLE public.registered_nodes OWNER TO postgres;

--
-- Name: request_quotas; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.request_quotas (
    id uuid NOT NULL,
    client_id uuid NOT NULL,
    rpc_method character varying(255),
    segment_count smallint NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    reported_by_id character varying(255) NOT NULL,
    last_segment_length smallint,
    chain_id character varying(255)
);


ALTER TABLE public.request_quotas OWNER TO postgres;

--
-- Name: response_quotas; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.response_quotas (
    id uuid NOT NULL,
    client_id uuid NOT NULL,
    rpc_method character varying(255),
    segment_count smallint NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    reported_by_id character varying(255) NOT NULL,
    last_segment_length smallint,
    chain_id character varying(255)
);


ALTER TABLE public.response_quotas OWNER TO postgres;

--
-- Name: users; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.users (
    id uuid NOT NULL,
    name character varying(255),
    email character varying(255),
    www_address character varying(1000),
    telegram character varying(255),
    last_logged_in_at timestamp without time zone,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp without time zone,
    mev_kickback_address character varying(255),
    mev_current_choice character varying(255)
);


ALTER TABLE public.users OWNER TO postgres;

--
-- Name: users_packages; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.users_packages (
    user_id uuid NOT NULL,
    package_id uuid NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    invalidated_at timestamp without time zone
);


ALTER TABLE public.users_packages OWNER TO postgres;

--
-- Name: vouchers; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.vouchers (
    id uuid NOT NULL,
    name character varying(255),
    code character varying(255) NOT NULL,
    valid_until timestamp without time zone,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp without time zone,
    package_id uuid NOT NULL,
    uses_left integer
);


ALTER TABLE public.vouchers OWNER TO postgres;

--
-- Name: webhook_logs; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.webhook_logs (
    id uuid NOT NULL,
    event_type character varying(255) NOT NULL,
    event_data jsonb NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.webhook_logs OWNER TO postgres;

--
-- Name: COLUMN webhook_logs.event_type; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.webhook_logs.event_type IS 'Type of the event, e.g., Subscription.Created';


--
-- Name: COLUMN webhook_logs.event_data; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.webhook_logs.event_data IS 'Payload of the webhook event';


--
-- Name: zero_hop_pairings; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.zero_hop_pairings (
    entry_id character varying(255) NOT NULL,
    exit_id character varying(255) NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.zero_hop_pairings OWNER TO postgres;

--
-- Name: billing_schemes billing_schemes_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.billing_schemes
    ADD CONSTRAINT billing_schemes_pkey PRIMARY KEY (id);


--
-- Name: boomfi_packages boomfi_packages_boomfi_package_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.boomfi_packages
    ADD CONSTRAINT boomfi_packages_boomfi_package_id_key UNIQUE (boomfi_package_id);


--
-- Name: chain_credentials chain_credentials_address_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.chain_credentials
    ADD CONSTRAINT chain_credentials_address_key UNIQUE (address);


--
-- Name: clients clients_external_token_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.clients
    ADD CONSTRAINT clients_external_token_key UNIQUE (external_token);


--
-- Name: clients clients_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.clients
    ADD CONSTRAINT clients_pkey PRIMARY KEY (id);


--
-- Name: configs configs_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.configs
    ADD CONSTRAINT configs_pkey PRIMARY KEY (key);


--
-- Name: degen_sessions degen_sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.degen_sessions
    ADD CONSTRAINT degen_sessions_pkey PRIMARY KEY (sid);


--
-- Name: exit_node_tokens exit_node_tokens_access_token_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.exit_node_tokens
    ADD CONSTRAINT exit_node_tokens_access_token_key UNIQUE (access_token);


--
-- Name: exit_node_tokens exit_node_tokens_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.exit_node_tokens
    ADD CONSTRAINT exit_node_tokens_pkey PRIMARY KEY (id);


--
-- Name: federated_credentials federated_credentials_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.federated_credentials
    ADD CONSTRAINT federated_credentials_pkey PRIMARY KEY (id);


--
-- Name: monthly_quota_usage_histories monthly_quota_usage_histories_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.monthly_quota_usage_histories
    ADD CONSTRAINT monthly_quota_usage_histories_pkey PRIMARY KEY (id);


--
-- Name: packages packages_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.packages
    ADD CONSTRAINT packages_pkey PRIMARY KEY (id);


--
-- Name: registered_nodes registered_nodes_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.registered_nodes
    ADD CONSTRAINT registered_nodes_pkey PRIMARY KEY (id);


--
-- Name: request_quotas request_quotas_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.request_quotas
    ADD CONSTRAINT request_quotas_pkey PRIMARY KEY (id);


--
-- Name: response_quotas response_quotas_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.response_quotas
    ADD CONSTRAINT response_quotas_pkey PRIMARY KEY (id);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: vouchers vouchers_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.vouchers
    ADD CONSTRAINT vouchers_pkey PRIMARY KEY (id);


--
-- Name: webhook_logs webhook_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.webhook_logs
    ADD CONSTRAINT webhook_logs_pkey PRIMARY KEY (id);


--
-- Name: boomfi_packages_package_id_index; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX boomfi_packages_package_id_index ON public.boomfi_packages USING btree (package_id);


--
-- Name: chain_credentials_user_id_index; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX chain_credentials_user_id_index ON public.chain_credentials USING btree (user_id);


--
-- Name: clients_user_id_index; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX clients_user_id_index ON public.clients USING btree (user_id);


--
-- Name: degen_sessions_expire_index; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX degen_sessions_expire_index ON public.degen_sessions USING btree (expire);


--
-- Name: exit_node_tokens_exit_id_index; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX exit_node_tokens_exit_id_index ON public.exit_node_tokens USING btree (exit_id);


--
-- Name: federated_credentials_user_id_index; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX federated_credentials_user_id_index ON public.federated_credentials USING btree (user_id);


--
-- Name: monthly_quota_usage_histories_user_id_index; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX monthly_quota_usage_histories_user_id_index ON public.monthly_quota_usage_histories USING btree (user_id);


--
-- Name: monthly_quota_usages_user_id_index; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX monthly_quota_usages_user_id_index ON public.monthly_quota_usages USING btree (user_id);


--
-- Name: one_hop_pairings_entry_id_exit_id_unique_index; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX one_hop_pairings_entry_id_exit_id_unique_index ON public.one_hop_pairings USING btree (entry_id, exit_id);


--
-- Name: one_hop_pairings_entry_id_index; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX one_hop_pairings_entry_id_index ON public.one_hop_pairings USING btree (entry_id);


--
-- Name: one_hop_pairings_exit_id_index; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX one_hop_pairings_exit_id_index ON public.one_hop_pairings USING btree (exit_id);


--
-- Name: packages_alternative_billing_scheme_id_index; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX packages_alternative_billing_scheme_id_index ON public.packages USING btree (alternative_billing_scheme_id);


--
-- Name: packages_billing_scheme_id_index; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX packages_billing_scheme_id_index ON public.packages USING btree (billing_scheme_id);


--
-- Name: redeemed_vouchers_user_id_index; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX redeemed_vouchers_user_id_index ON public.redeemed_vouchers USING btree (user_id);


--
-- Name: redeemed_vouchers_user_id_voucher_id_unique_index; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX redeemed_vouchers_user_id_voucher_id_unique_index ON public.redeemed_vouchers USING btree (user_id, voucher_id);


--
-- Name: redeemed_vouchers_voucher_id_index; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX redeemed_vouchers_voucher_id_index ON public.redeemed_vouchers USING btree (voucher_id);


--
-- Name: request_quotas_client_id_index; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX request_quotas_client_id_index ON public.request_quotas USING btree (client_id);


--
-- Name: request_quotas_reported_by_id_index; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX request_quotas_reported_by_id_index ON public.request_quotas USING btree (reported_by_id);


--
-- Name: response_quotas_client_id_index; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX response_quotas_client_id_index ON public.response_quotas USING btree (client_id);


--
-- Name: response_quotas_reported_by_id_index; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX response_quotas_reported_by_id_index ON public.response_quotas USING btree (reported_by_id);


--
-- Name: users_packages_package_id_index; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX users_packages_package_id_index ON public.users_packages USING btree (package_id);


--
-- Name: users_packages_user_id_index; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX users_packages_user_id_index ON public.users_packages USING btree (user_id);


--
-- Name: vouchers_code_unique_index; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX vouchers_code_unique_index ON public.vouchers USING btree (code);


--
-- Name: vouchers_package_id_index; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX vouchers_package_id_index ON public.vouchers USING btree (package_id);


--
-- Name: zero_hop_pairings_entry_id_exit_id_unique_index; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX zero_hop_pairings_entry_id_exit_id_unique_index ON public.zero_hop_pairings USING btree (entry_id, exit_id);


--
-- Name: zero_hop_pairings_entry_id_index; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX zero_hop_pairings_entry_id_index ON public.zero_hop_pairings USING btree (entry_id);


--
-- Name: zero_hop_pairings_exit_id_index; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX zero_hop_pairings_exit_id_index ON public.zero_hop_pairings USING btree (exit_id);


--
-- Name: users init_monthly_usage; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER init_monthly_usage AFTER INSERT ON public.users FOR EACH ROW EXECUTE FUNCTION public.process_initial_monthly_usage();


--
-- Name: request_quotas monthly_req_usage; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER monthly_req_usage AFTER INSERT ON public.request_quotas FOR EACH ROW EXECUTE FUNCTION public.process_monthly_usage();


--
-- Name: response_quotas monthly_resp_usage; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER monthly_resp_usage AFTER INSERT ON public.response_quotas FOR EACH ROW EXECUTE FUNCTION public.process_monthly_usage();


--
-- Name: associated_nodes associated_nodes_node_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.associated_nodes
    ADD CONSTRAINT associated_nodes_node_id_fkey FOREIGN KEY (node_id) REFERENCES public.registered_nodes(id);


--
-- Name: associated_nodes associated_nodes_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.associated_nodes
    ADD CONSTRAINT associated_nodes_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: boomfi_packages boomfi_packages_package_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.boomfi_packages
    ADD CONSTRAINT boomfi_packages_package_id_fkey FOREIGN KEY (package_id) REFERENCES public.packages(id);


--
-- Name: chain_credentials chain_credentials_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.chain_credentials
    ADD CONSTRAINT chain_credentials_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: clients clients_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.clients
    ADD CONSTRAINT clients_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: exit_node_tokens exit_node_tokens_exit_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.exit_node_tokens
    ADD CONSTRAINT exit_node_tokens_exit_id_fkey FOREIGN KEY (exit_id) REFERENCES public.registered_nodes(id);


--
-- Name: federated_credentials federated_credentials_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.federated_credentials
    ADD CONSTRAINT federated_credentials_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: monthly_quota_usage_histories monthly_quota_usage_histories_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.monthly_quota_usage_histories
    ADD CONSTRAINT monthly_quota_usage_histories_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: monthly_quota_usages monthly_quota_usages_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.monthly_quota_usages
    ADD CONSTRAINT monthly_quota_usages_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: one_hop_pairings one_hop_pairings_entry_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.one_hop_pairings
    ADD CONSTRAINT one_hop_pairings_entry_id_fkey FOREIGN KEY (entry_id) REFERENCES public.registered_nodes(id);


--
-- Name: one_hop_pairings one_hop_pairings_exit_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.one_hop_pairings
    ADD CONSTRAINT one_hop_pairings_exit_id_fkey FOREIGN KEY (exit_id) REFERENCES public.registered_nodes(id);


--
-- Name: packages packages_alternative_billing_scheme_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.packages
    ADD CONSTRAINT packages_alternative_billing_scheme_id_fkey FOREIGN KEY (alternative_billing_scheme_id) REFERENCES public.billing_schemes(id);


--
-- Name: packages packages_billing_scheme_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.packages
    ADD CONSTRAINT packages_billing_scheme_id_fkey FOREIGN KEY (billing_scheme_id) REFERENCES public.billing_schemes(id);


--
-- Name: redeemed_vouchers redeemed_vouchers_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.redeemed_vouchers
    ADD CONSTRAINT redeemed_vouchers_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: redeemed_vouchers redeemed_vouchers_voucher_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.redeemed_vouchers
    ADD CONSTRAINT redeemed_vouchers_voucher_id_fkey FOREIGN KEY (voucher_id) REFERENCES public.vouchers(id);


--
-- Name: request_quotas request_quotas_client_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.request_quotas
    ADD CONSTRAINT request_quotas_client_id_fkey FOREIGN KEY (client_id) REFERENCES public.clients(id);


--
-- Name: request_quotas request_quotas_reported_by_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.request_quotas
    ADD CONSTRAINT request_quotas_reported_by_id_fkey FOREIGN KEY (reported_by_id) REFERENCES public.registered_nodes(id);


--
-- Name: response_quotas response_quotas_client_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.response_quotas
    ADD CONSTRAINT response_quotas_client_id_fkey FOREIGN KEY (client_id) REFERENCES public.clients(id);


--
-- Name: response_quotas response_quotas_reported_by_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.response_quotas
    ADD CONSTRAINT response_quotas_reported_by_id_fkey FOREIGN KEY (reported_by_id) REFERENCES public.registered_nodes(id);


--
-- Name: users_packages users_packages_package_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users_packages
    ADD CONSTRAINT users_packages_package_id_fkey FOREIGN KEY (package_id) REFERENCES public.packages(id);


--
-- Name: users_packages users_packages_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users_packages
    ADD CONSTRAINT users_packages_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: vouchers vouchers_package_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.vouchers
    ADD CONSTRAINT vouchers_package_id_fkey FOREIGN KEY (package_id) REFERENCES public.packages(id);


--
-- Name: zero_hop_pairings zero_hop_pairings_entry_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.zero_hop_pairings
    ADD CONSTRAINT zero_hop_pairings_entry_id_fkey FOREIGN KEY (entry_id) REFERENCES public.registered_nodes(id);


--
-- Name: zero_hop_pairings zero_hop_pairings_exit_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.zero_hop_pairings
    ADD CONSTRAINT zero_hop_pairings_exit_id_fkey FOREIGN KEY (exit_id) REFERENCES public.registered_nodes(id);
