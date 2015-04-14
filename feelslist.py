#!/usr/bin/python
# -*- coding: utf-8 -*-

import MySQLdb as mdb
import sys

con = mdb.connect('localhost', 'root', 'linkii', 'feeldb');
    
with con:
    cur = con.cursor()
    cur.execute("drop table if exists tracks")
    cur.execute("create table tracks(id int primary key auto_increment, \
            title text, \
            artist text)")
    cur.execute("insert into tracks(title, artist) values('lie lie lie', 'sim gar')")
    cur.execute("insert into tracks(title, artist) values('roar', 'fak')")
    cur.execute("insert into tracks(title, artist) values('happy day', 'orange')")
    cur.execute("insert into tracks(title, artist) values('cider', 'herrljunga')")
    cur.execute("insert into tracks(title, artist) values('no face', 'jake')")

