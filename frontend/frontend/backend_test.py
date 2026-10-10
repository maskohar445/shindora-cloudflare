import json
import os
import sys
import urllib.error
import urllib.request
import uuid

BASE = os.environ.get('BASE_URL', 'https://shindora-deploy.preview.emergentagent.com').rstrip('/') + '/api'

def request(path, method='GET', body=None):
    data = None if body is None else json.dumps(body).encode()
    req = urllib.request.Request(BASE + path, data=data, method=method, headers={'Content-Type':'application/json','User-Agent':'backend-test/1.0'})
    try:
        with urllib.request.urlopen(req, timeout=30) as res:
            raw = res.read().decode()
            try: payload = json.loads(raw)
            except json.JSONDecodeError: payload = raw
            return res.status, payload
    except urllib.error.HTTPError as err:
        raw = err.read().decode()
        try: payload = json.loads(raw)
        except json.JSONDecodeError: payload = raw
        return err.code, payload

def check(name, condition, detail=''):
    print(('PASS' if condition else 'FINDING') + ': ' + name + ((' - ' + detail) if detail else ''))
    return condition

def main():
    failures = 0
    marker = uuid.uuid4().hex[:10]
    script = '<script>window.__shindora_ad_marker="%s";</script>' % marker
    ad_ids = []
    for slot in ['banner_below_player','banner_sidebar','custom_head_code','banner_float_bottom']:
        status, payload = request('/ads', 'POST', {'title':'QA Raw Script '+slot, 'slot':slot, 'position':slot, 'html':script, 'content':script, 'isRaw':True, 'isActive':True})
        ok = status == 200 and isinstance(payload, dict) and payload.get('id') and payload.get('isRaw') is True and (payload.get('html') == script or payload.get('content') == script)
        failures += not check('ads POST raw script '+slot, ok, f'{status} {payload}')
        if isinstance(payload, dict) and payload.get('id'): ad_ids.append(payload['id'])
    status, ads = request('/ads')
    failures += not check('ads GET includes raw script slots', status == 200 and isinstance(ads, list) and all(any(a.get('id') == i for a in ads) for i in ad_ids), f'{status} count={len(ads) if isinstance(ads,list) else ads}')
    if ad_ids:
        aid = ad_ids[0]
        updated_script = '<script>document.currentScript.dataset.qa="updated";</script>'
        status, payload = request('/promo', 'PUT', {'id':aid, 'html':updated_script, 'content':updated_script, 'isRaw':True, 'slot':'banner_below_player', 'isActive':False})
        failures += not check('ads PUT preserves raw HTML', status == 200 and isinstance(payload,dict) and payload.get('id') == aid and payload.get('html') == updated_script and payload.get('isRaw') is True, f'{status} {payload}')
        status, payload = request('/ads?id='+aid, 'DELETE')
        failures += not check('ads DELETE', status == 200 and isinstance(payload,dict) and payload.get('success') is True, f'{status} {payload}')
    sub = {'endpoint':'https://updates.push.services.mozilla.com/wpush/v2/qa-'+marker, 'p256dh':'BNcQA-test-public-key-'+marker, 'auth':'qa-auth-'+marker}
    status, payload = request('/push/subscribe', 'POST', sub)
    failures += not check('push subscribe persists subscriber', status in (200,201) and isinstance(payload,dict) and payload.get('success') is True, f'{status} {payload}')
    status, payload = request('/push/status')
    failures += not check('push status subscribersCount', status == 200 and isinstance(payload,dict) and isinstance(payload.get('subscribersCount'), int) and payload['subscribersCount'] >= 1 and 'vapidConfigured' in payload, f'{status} {payload}')
    status, payload = request('/push/test', 'POST', {})
    failures += not check('push test handled without server error', status != 500 and isinstance(payload,dict) and 'success' in payload, f'{status} {payload}')
    video = {'title':'QA Push Broadcast '+marker, 'animeTitle':'Doraemon', 'episode':'Episode 999', 'videoUrl':'https://cdn.example.com/qa-'+marker+'.mp4', 'thumbnailUrl':'https://cdn.example.com/qa-'+marker+'.jpg', 'status':'published'}
    status, created = request('/videos', 'POST', video)
    vid = created.get('id') if isinstance(created,dict) else None
    failures += not check('published video creation returns video', status == 200 and vid and created.get('status') == 'published', f'{status} {created}')
    if vid:
        status, payload = request('/videos/notify', 'POST', {'id':vid})
        failures += not check('video notify broadcast handled', status == 200 and isinstance(payload,dict) and payload.get('success') is True and 'total' in payload, f'{status} {payload}')
        status, updated = request('/videos', 'PUT', {'id':vid, 'title':video['title']+' edited', 'status':'published'})
        failures += not check('unchanged published video update succeeds without duplicate push', status == 200 and isinstance(updated,dict) and updated.get('id') == vid and updated.get('status') == 'published', f'{status} {updated}')
        status, payload = request('/videos?id='+vid, 'DELETE')
        failures += not check('cleanup created video', status == 200 and isinstance(payload,dict) and payload.get('success') is True, f'{status} {payload}')
    status, payload = request('/push/unsubscribe', 'POST', {'endpoint':sub['endpoint']})
    failures += not check('cleanup push subscription', status == 200 and isinstance(payload,dict) and payload.get('success') is True, f'{status} {payload}')
    print('RESULT: %s; findings=%d' % ('FAIL' if failures else 'PASS', failures))
    return 1 if failures else 0

if __name__ == '__main__': sys.exit(main())
