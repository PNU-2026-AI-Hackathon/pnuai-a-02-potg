import 'server-only';

import { redirect } from 'next/navigation';
import { getCurrentUser } from './server-auth';
import { isStudioStaff } from './auth-config';

/**
 * 스튜디오 화면 앞에서 부른다. 사서가 아니면 들여보내지 않는다.
 *
 * 그동안 스튜디오를 막는 규칙은 소개 화면의 버튼 하나에만 있었다. 버튼은 브라우저에서
 * 도는 코드라 주소를 직접 치면 화면이 그냥 열렸다. 판단을 서버에서도 한 번 한다.
 *
 * 로그인하지 않은 사람은 로그인 화면으로 보내되 돌아올 곳을 함께 넘긴다. 로그인은
 * 했지만 사서가 아닌 사람은 소개 화면으로 보낸다. 거기서 왜 못 쓰는지 읽을 수 있다.
 */
export async function requireStudioStaff(returnTo: string) {
  const user = await getCurrentUser();

  if (!user) {
    redirect(`/login?next=${encodeURIComponent(returnTo)}`);
  }

  if (!isStudioStaff(user.accountType)) {
    redirect('/studio/about');
  }

  return user;
}
