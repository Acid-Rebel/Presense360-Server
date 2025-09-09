--
-- PostgreSQL database dump
--

-- Dumped from database version 17.2
-- Dumped by pg_dump version 17.2

-- Started on 2025-09-04 02:09:43

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- TOC entry 221 (class 1259 OID 534270)
-- Name: department; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.department (
    id integer NOT NULL,
    label character varying(50)
);


ALTER TABLE public.department OWNER TO postgres;

--
-- TOC entry 223 (class 1259 OID 534297)
-- Name: device_id; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.device_id (
    id character varying(50) NOT NULL,
    dev_id character varying(50)
);


ALTER TABLE public.device_id OWNER TO postgres;

--
-- TOC entry 218 (class 1259 OID 534237)
-- Name: face_info; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.face_info (
    id character varying(50) NOT NULL,
    status integer
);


ALTER TABLE public.face_info OWNER TO postgres;

--
-- TOC entry 220 (class 1259 OID 534255)
-- Name: location_info; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.location_info (
    id character varying(50) NOT NULL,
    locid character varying(50)
);


ALTER TABLE public.location_info OWNER TO postgres;

--
-- TOC entry 219 (class 1259 OID 534250)
-- Name: locations; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.locations (
    id character varying(50) NOT NULL,
    coordinates jsonb
);


ALTER TABLE public.locations OWNER TO postgres;

--
-- TOC entry 222 (class 1259 OID 534285)
-- Name: login_info; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.login_info (
    id character varying(50) NOT NULL,
    password character varying(20)
);


ALTER TABLE public.login_info OWNER TO postgres;

--
-- TOC entry 224 (class 1259 OID 534307)
-- Name: user_attendance; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.user_attendance (
    id character varying(50) NOT NULL,
    currdate date NOT NULL,
    checkin time without time zone,
    checkout time without time zone,
    type integer
);


ALTER TABLE public.user_attendance OWNER TO postgres;

--
-- TOC entry 217 (class 1259 OID 534232)
-- Name: user_info; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.user_info (
    id character varying(50) NOT NULL,
    name character varying(50),
    mobile character varying(15),
    dept integer
);


ALTER TABLE public.user_info OWNER TO postgres;

--
-- TOC entry 4941 (class 0 OID 534270)
-- Dependencies: 221
-- Data for Name: department; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.department (id, label) FROM stdin;
1	Sales
2	Engineer
3	HR
\.


--
-- TOC entry 4943 (class 0 OID 534297)
-- Dependencies: 223
-- Data for Name: device_id; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.device_id (id, dev_id) FROM stdin;
001	d8d43f6936e29e28
\.


--
-- TOC entry 4938 (class 0 OID 534237)
-- Dependencies: 218
-- Data for Name: face_info; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.face_info (id, status) FROM stdin;
001	2
\.


--
-- TOC entry 4940 (class 0 OID 534255)
-- Dependencies: 220
-- Data for Name: location_info; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.location_info (id, locid) FROM stdin;
001	Main Building
\.


--
-- TOC entry 4939 (class 0 OID 534250)
-- Dependencies: 219
-- Data for Name: locations; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.locations (id, coordinates) FROM stdin;
Main Building	[[10.902880180472406, 76.89578929638921], [10.902880180472406, 76.8966336745119], [10.902231647293982, 76.89662531433248], [10.90223575193879, 76.89577257603034], [10.902880180472406, 76.89578929638921]]
\.


--
-- TOC entry 4942 (class 0 OID 534285)
-- Dependencies: 222
-- Data for Name: login_info; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.login_info (id, password) FROM stdin;
001	12345
\.


--
-- TOC entry 4944 (class 0 OID 534307)
-- Dependencies: 224
-- Data for Name: user_attendance; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.user_attendance (id, currdate, checkin, checkout, type) FROM stdin;
001	2025-08-26	02:36:27	\N	0
\.


--
-- TOC entry 4937 (class 0 OID 534232)
-- Dependencies: 217
-- Data for Name: user_info; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.user_info (id, name, mobile, dept) FROM stdin;
001	Ajeth	9751689740	1
\.


--
-- TOC entry 4778 (class 2606 OID 534274)
-- Name: department department_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.department
    ADD CONSTRAINT department_pkey PRIMARY KEY (id);


--
-- TOC entry 4782 (class 2606 OID 534301)
-- Name: device_id device_id_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.device_id
    ADD CONSTRAINT device_id_pkey PRIMARY KEY (id);


--
-- TOC entry 4772 (class 2606 OID 534241)
-- Name: face_info face_info_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.face_info
    ADD CONSTRAINT face_info_pkey PRIMARY KEY (id);


--
-- TOC entry 4776 (class 2606 OID 534259)
-- Name: location_info location_info_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.location_info
    ADD CONSTRAINT location_info_pkey PRIMARY KEY (id);


--
-- TOC entry 4774 (class 2606 OID 534254)
-- Name: locations locations_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.locations
    ADD CONSTRAINT locations_pkey PRIMARY KEY (id);


--
-- TOC entry 4780 (class 2606 OID 534289)
-- Name: login_info login_info_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.login_info
    ADD CONSTRAINT login_info_pkey PRIMARY KEY (id);


--
-- TOC entry 4784 (class 2606 OID 534311)
-- Name: user_attendance user_attendance_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_attendance
    ADD CONSTRAINT user_attendance_pkey PRIMARY KEY (id, currdate);


--
-- TOC entry 4770 (class 2606 OID 534236)
-- Name: user_info user_info_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_info
    ADD CONSTRAINT user_info_pkey PRIMARY KEY (id);


--
-- TOC entry 4790 (class 2606 OID 534302)
-- Name: device_id device_id_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.device_id
    ADD CONSTRAINT device_id_id_fkey FOREIGN KEY (id) REFERENCES public.user_info(id);


--
-- TOC entry 4786 (class 2606 OID 534242)
-- Name: face_info fnk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.face_info
    ADD CONSTRAINT fnk FOREIGN KEY (id) REFERENCES public.user_info(id);


--
-- TOC entry 4787 (class 2606 OID 534265)
-- Name: location_info fnk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.location_info
    ADD CONSTRAINT fnk FOREIGN KEY (id) REFERENCES public.user_info(id);


--
-- TOC entry 4788 (class 2606 OID 534260)
-- Name: location_info location_info_locid_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.location_info
    ADD CONSTRAINT location_info_locid_fkey FOREIGN KEY (locid) REFERENCES public.locations(id);


--
-- TOC entry 4789 (class 2606 OID 534290)
-- Name: login_info login_info_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.login_info
    ADD CONSTRAINT login_info_id_fkey FOREIGN KEY (id) REFERENCES public.user_info(id);


--
-- TOC entry 4791 (class 2606 OID 534312)
-- Name: user_attendance user_attendance_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_attendance
    ADD CONSTRAINT user_attendance_id_fkey FOREIGN KEY (id) REFERENCES public.user_info(id);


--
-- TOC entry 4785 (class 2606 OID 534275)
-- Name: user_info user_info_dept_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_info
    ADD CONSTRAINT user_info_dept_fkey FOREIGN KEY (dept) REFERENCES public.department(id);


-- Completed on 2025-09-04 02:09:43

--
-- PostgreSQL database dump complete
--

