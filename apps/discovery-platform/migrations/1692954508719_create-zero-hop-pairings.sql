-- Up Migration

CREATE TABLE public.zero_hop_pairings (
    entry_id character varying(255) NOT NULL,
    exit_id character varying(255) NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.zero_hop_pairings OWNER TO postgres;

CREATE UNIQUE INDEX zero_hop_pairings_entry_id_exit_id_unique_index ON public.zero_hop_pairings USING btree (entry_id, exit_id);

-- Down Migration

DROP TABLE public.zero_hop_pairings;
