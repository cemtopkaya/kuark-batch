'use strict';

var mysql = require('mysql'),
    $ = require('cheerio'),
    /** @type {DBModel} */
    db = require('../../../kuark-db')(),
    redis = db.redis,
    elastic = db.elastic,
    tabletojson = require('tabletojson'),
    exception = require("kuark-istisna"),
    extensions = require("../../../kuark-extensions"),
    schema = require('../../../kuark-schema');


/** @type {IhaleDunyasi} */
function ihaleDunyasi() {

    /*
     * Ihale dünyasından son çekilmiş ihale_id yi redisten çeki
     * mysql kayıtlarından ihale_id den sonraki X ihaleyi çek
     * Redise uygun nesneyi oluştur
     * Redise kaydet
     * */

    /** @type {IhaleDunyasi} */
    var result = {};

    /**
     * mysql e bağlan
     */
    function f_ihaleDunyasinaBaglan() {

        var connection = mysql.createConnection({
            //host: 'ihaledunyasi.net',
            host: '213.238.162.70',
            port: '3306',
            //user: 'fres',
            user: 'fmcag',
            //password: 'fres34',
            password: '1.fmc-ag',
            database: 'sbyeni'
            //charset:"UTF8_GENERAL_CI"
        });

        connection.connect(function (err) {
            if (err) {
                console.error('MySql error while connecting: ' + err.stack);
                return;
            }

            console.log('MySQL connected as id ' + connection.threadId);
        });

        return connection;
    }

    /**
     * ihale_id den sonraki son X ihaleyi çek
     * @param {integer} _ihale_id
     * @param {integer} [_topX=10] _topX
     * @param {function} _successFn
     * @param {function} _errFn
     */
    function f_ihaleDunyasindanCek(_ihale_id, _topX) {
        var defer = redis.dbQ.Q.defer();
        console.log("ihale dünyasından cekmeden onceki argumanlar: " + JSON.stringify(arguments));
        // MySql bağlantısı kurulsun
        result.connection = f_ihaleDunyasinaBaglan();

        var queryWhere = _ihale_id
            ? "WHERE ihale_id>" + _ihale_id
            : "";

        var queryLimit = _topX
            ? "LIMIT " + _topX
            : "LIMIT 2";

        //var query = "SELECT * FROM webservis " + queryWhere + " " + queryLimit;
        var query = "SELECT * FROM ihale " + queryWhere + " " + queryLimit;

        console.log(query);

        result.connection.query(query, function (err, rows) {
            if (err) {
                console.log("Errr: ");
                console.log(err);
                defer.reject(err);
            } else {
                console.log("Çekilen kayıt sayısı: " + rows.length);
                defer.resolve(rows);
            }
        });

        return defer.promise;
    }

    /**
     * Elastşc indeks temizlik işlemi
     */
    function f_ElasticTemizle() {
        // İndeksi silip cache'i boşaltalım. Sıfır başlangıç için.
        elastic.client.indices.clearCache();
        elastic.client.indices.flush();
        elastic.client.indices.delete({index: elastic.SABIT.INDEKS.APP}, function (err, resp, respcode) {
            elastic.client.indices.create({
                index: elastic.SABIT.INDEKS.APP,
                body: {
                    "mappings": {
                        "urun": {
                            "properties": {
                                "Adi": {"type": "string", "index": "analyzed"}
                            }
                        },
                        "kurum": {
                            "properties": {
                                "Adi": {"type": "string", "index": "analyzed"}
                            }
                        },
                        "ihale": {
                            "properties": {
                                "Konusu": {"type": "string", "index": "analyzed"}
                            }
                        },
                        "kalem": {
                            "properties": {
                                "Aciklama": {"type": "string", "index": "analyzed"},
                                "BransKodu": {"type": "string", "index": "analyzed"}
                            }
                        }
                    }
                }
            }, function (err, resp, respcode) {
                console.log(err, resp, respcode);
            });
        });
    }

    /**
     * Gelen ihale db de var mı yok mu buluyoruz
     * @param {string|integer} _ihaleDunyasi_id
     * @returns {Promise|string}
     */
    function f_ihaleRedisteVarmi(_ihaleDunyasi_id) {
        return redis.dbQ.hexists(redis.kp.ihale.ihaleDunyasi.tablo, _ihaleDunyasi_id);
    }

    /**
     * İhale dünyasından gelen ihale id yi sisteme ekliyoruz ki o id den sonraki kayıtları çekebilelim.
     * @param _ihaleDunyasi_id
     * @returns {Promise|string}
     */
    function f_ihaleIdsiniKaydet(_ihaleDunyasi_id) {
        return redis.dbQ.set(redis.kp.ihale.ihaleDunyasi.idx, parseInt(_ihaleDunyasi_id));
    }

    /**
     * Db de kayıtlı son ihale dunyası id sini çekiyoruz
     * @returns {*}
     */
    function f_sonIhaleIdsiniCek() {
        return redis.dbQ.get(redis.kp.ihale.ihaleDunyasi.idx);
    }

    /**
     * İhale dünyasından gelen ili db ye ekle
     * @param {string} _ilAdi
     * @returns {Promise}
     */
    function f_sehir_ekle(_ilAdi) {
        var defer = redis.dbQ.Q.defer();
        if (_ilAdi) {
            defer = db.sehir.f_db_sehir_ekle(/** @type {Sehir} */{Id: 0, Adi: _ilAdi});
        } else {
            defer.resolve(null);
        }
        return defer.promise;
    }

    /**
     * İhale dünyasından gelen bölgeyi db ye ekle
     * @param {string} _bolgeAdi
     * @returns {Promise}
     */
    function f_bolge_ekle(_bolgeAdi) {
        var defer = redis.dbQ.Q.defer();
        if (_bolgeAdi) {
            defer = db.bolge.f_db_bolge_ekle(/** @type {Bolge} */{Id: 0, Adi: _bolgeAdi});
        } else {
            defer.resolve(null);
        }
        return defer.promise;
    }

    function f_ihaleyiRediseKaydet(_elm, _sehir, _bolge) {

        var listeIhaleDunyasiHtml = _elm.liste.replace(/(\r\n|\n|\r)/gm, "").replace(/(<p>|<\/p>)/gm, ""),
            listeIhaleDunyasiJSON = tabletojson.convert(listeIhaleDunyasiHtml)[0],
            dosyalarIhaleDunyasiHtml = _elm.sartnamesi.replace(/(\r\n|\n|\r)/gm, "").replace(/(<p>|<\/p>)/gm, "").replace(/(<br>|<br\/>)/gm, "");

        var kurumIhaleDunyasi = schema.f_create_default_object(schema.SCHEMA.KURUM);
        kurumIhaleDunyasi.IhaleDunyasiKurumId = _elm.kurum_id;
        kurumIhaleDunyasi.Adi = _elm.kurum_ad;


        var kamu_kurumu_mu = (_elm.kurum_ad.turkishToLower().indexOf("kamu") > -1);
        kurumIhaleDunyasi.Kurumdur = kamu_kurumu_mu ? 1 : 0;
        kurumIhaleDunyasi.Statu = kamu_kurumu_mu ? "Kamu" : "Özel";
        kurumIhaleDunyasi.UlkeAdi = "Türkiye";
        //kurumIhaleDunyasi.IlAdi = _elm.ilad;
        kurumIhaleDunyasi.Sehir_Id = _sehir ? _sehir.Id : 0;
        kurumIhaleDunyasi.Bolge_Id = _bolge ? _bolge.Id : 0;

        var db_kurum = schema.f_suz_klonla(schema.SCHEMA.DB.KURUM, kurumIhaleDunyasi);

        return db.kurum.f_db_kurum_ekle_ihaleDunyasindan(db_kurum, kurumIhaleDunyasi.IhaleDunyasiKurumId)
            .then(function (_dbKurum) {

                // Kurum eklendi ya da redisten bulundu
                // şimdi ihaleyi oluşturup sisteme girelim

                /** @type {Ihale} */
                var ihale = schema.f_create_default_object(schema.SCHEMA.IHALE);

                extensions.ssg = [{"ihale": ihale}];
                ihale.IhaleProviders.IhaleDunyasi = {};
                ihale.IhaleProviders.IhaleDunyasi.IhaleDunyasiId = _elm.ihale_id;
                ihale.IhaleProviders.IhaleDunyasi.raw = JSON.stringify(_elm);
                ihale.IhaleNo = _elm.kayit_no;
                ihale.Konusu = _elm.konu;
                ihale.IhaleTarihi = new Date(_elm.tarih).getTime();
                ihale.DuzenlemeTarihi = new Date(_elm.duzenleme_tarihi).getTime();
                ihale.IhaleUsul = _elm.usul_ad;
                ihale.IlAdi = _elm.ilad;
                ihale.BolgeAdi = _elm.bolge;
                ihale.SistemeEklenmeTarihi = new Date(_elm.ekleme_tarihi).getTime();
                ihale.Kurum_Id = _dbKurum.Id;
                ihale.Kurum = _dbKurum;
                ihale.IhaleNotu = (_elm.iptal && _elm.iptal == 1) ? "İhale iptal olmuştur." : "";
                ihale.SartnameAdres = _elm.sartnamesi.replace("\r\n", "").trim();

                var basliklar = listeIhaleDunyasiJSON[0];
                console.log(basliklar);

                var _idx = 0,
                    idxAciklama,
                    idxSiraNo,
                    idxBirim,
                    idxMiktar,
                    idxBransKodu;
                for (var _prop in basliklar) {
                    console.log("_prop: ", _prop);
                    var th = basliklar[_prop];
                    // TODO: regular expression ile indexof lar yer değiştirecek
                    if (th.indexOf('klama') > 0
                        || th.toLowerCase().indexOf('cinsi') > -1
                        || th.toLowerCase().indexOf('cınsı') > -1
                        || th.toLowerCase().indexOf('cins') > -1
                        || th.toLowerCase().indexOf('adı') > -1
                        || th.toLowerCase().indexOf('adi') > -1
                        || th.toLowerCase().indexOf('zell') > -1
                        || th.toLowerCase().indexOf('mkys') > -1) {
                        idxAciklama = _prop;
                    } else if (th.toLowerCase().indexOf('sıra') > -1 || th.toLowerCase().indexOf('sira') > -1 || th.toLowerCase().indexOf('sn') > -1) {
                        idxSiraNo = _prop;
                    } else if (th.toLowerCase().indexOf('birim') > -1 || th.toLowerCase().indexOf('bırım') > -1) {
                        idxBirim = _prop;
                    } else if (th.toLowerCase().indexOf('ktar') > -1) {
                        idxMiktar = _prop;
                    } else if (th.toLowerCase().indexOf('bran') > -1) {
                        idxBransKodu = _prop;
                    }
                }
                ihale.Kalemler = (Array.isArray(listeIhaleDunyasiJSON)
                    ? listeIhaleDunyasiJSON.slice(1)
                    : []).map(function (_elm) {

                    var kalem = schema.f_create_default_object(schema.SCHEMA.DB.KALEM);
                    //console.log(_elm);
                    kalem.SiraNo = _elm[idxSiraNo];
                    kalem.Aciklama = _elm[idxAciklama];
                    kalem.Birim = _elm[idxBirim];
                    kalem.Miktar = _elm[idxMiktar];
                    kalem.BransKodu = _elm[idxBransKodu];
                    return kalem;
                });

                // Şartname içindeki a etiketlerini bulalım ve diziye çevirelim.
                var aTags = $('a', dosyalarIhaleDunyasiHtml);
                ihale.DosyaEkleri = aTags.map(function (_pos, _elm) {

                    var dosyaEki = schema.f_create_default_object(schema.SCHEMA.DOSYA_EKI);
                    dosyaEki.Href = $(_elm).attr('href');
                    dosyaEki.Aciklama = $(_elm).text();
                    return dosyaEki;
                }).get();

                var es_ihale = schema.f_suz_klonla(schema.SCHEMA.ES.IHALE, ihale),
                    db_ihale = schema.f_suz_klonla(schema.SCHEMA.DB.IHALE, ihale);

                return db.ihale.f_db_ihale_ekle_ihaleDunyasindan(es_ihale, db_ihale, 0);
            })
            .fail(function (_err) {
                console.log(_err);
                throw new exception.Istisna("İhale dünyasından kayıtlar çekilen kayıtlar eklenemedi.", "HATA ALINDI:" + _err)
            });
    }

    /**
     * İhale dünyasından gelen ihale_id sistemde yoksa önce idyi sonra da ona bağlı ihale,kalem,kurum bilgilerini sisteme ekliyoruz
     * @param _elm
     * @returns {*}
     */
    function f_ihaleDunyasiIhalesiniKaydet(_elm) {
        var defer = redis.dbQ.Q.defer();

        f_ihaleRedisteVarmi(_elm.ihale_id).then(function (_ihaleVarmi) {
                if (_ihaleVarmi === 0) {
                    return f_ihaleIdsiniKaydet(_elm.ihale_id).then(function () {
                        //bölge ve şehir kaydet
                        return redis.dbQ.Q.all([
                            f_sehir_ekle(_elm.ilad),
                            f_bolge_ekle(_elm.bolge)
                        ]).then(function (_ress) {
                            return f_ihaleyiRediseKaydet(_elm, _ress[0], _ress[1])
                        });
                    });
                }
            })
            .then(function (_result) {
                defer.resolve(_result);
            })
            .fail(function (_err) {
                defer.reject(_err);
            });

        return defer.promise;
    }

    /**
     * İhale dünyasından istenilen adet kadar ihaleyi çekip redis e ekliyoruz
     * @param {string|integer} _ihale_id ihale id si
     * @param {string|integer} _topX adet
     * @returns {*}
     */
    function f_ihaleDunyasindanCekRediseEkle(_ihale_id, _topX) {
        //f_ElasticTemizle();

        //return redis.dbQ.flushdb()
        //  .then(function () {

        if (_ihale_id) {

            return f_ihaleDunyasindanCek(_ihale_id, _topX)
                .then(function (_rows) {
                    return _rows.mapX(null, f_ihaleDunyasiIhalesiniKaydet).allX();
                });

        } else {
            /** DB deki son ihaleDunyası id sini çekip sonrakilerinde topX kadar ihale çekecek*/
            return f_sonIhaleIdsiniCek()
                .then(function (_ihaleDunyasi_id) {

                    var ihaleDunyasi_id = _ihaleDunyasi_id || 0;

                    return f_ihaleDunyasindanCek(ihaleDunyasi_id, _topX)
                        .then(function (_rows) {
                            return _rows.mapX(null, f_ihaleDunyasiIhalesiniKaydet).allX();
                        });
                })
        }

        // });
    }

    /** @class IhaleDunyasi */
    result = {
        connection: null,
        f_ihaleDunyasindanCek: f_ihaleDunyasindanCek,
        f_ihaleDunyasindanCekRediseEkle: f_ihaleDunyasindanCekRediseEkle
    };

    return result;
}

/** @type {IhaleDunyasi} */
var obj = ihaleDunyasi();
module.exports = obj;